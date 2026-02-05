import React, { useState, useEffect, useRef } from 'react';
import { useEmpresa } from '../EmpresaContext';
import { generarResumenTexto, exportarAPDFReal } from '../utils/exportUtils';
import apiService from '../services/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const EnviarPresupuestoModal = ({ show, onClose, presupuestoPreseleccionado = null, onAbrirPresupuestoParaPDF = null, onAbrirPresupuestoParaEmail = null, onSuccess = null }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState(null);
  const [mostrarPrevisualizacion, setMostrarPrevisualizacion] = useState(false);
  const [mostrarFormularioFiltros, setMostrarFormularioFiltros] = useState(true);
  const previewRef = useRef(null);
  const [enviando, setEnviando] = useState(false);

  // 🆕 CONSOLIDACIÓN DE ITEMS CALCULADORA (igual que modal de edición)
  const itemsCalculadoraConsolidados = React.useMemo(() => {
    console.log('🔥🔥🔥 MODAL ENVÍO - EJECUTANDO CONSOLIDACIÓN');
    console.log('  - presupuestoSeleccionado existe:', !!presupuestoSeleccionado);
    console.log('  - itemsCalculadora:', presupuestoSeleccionado?.itemsCalculadora);
    console.log('  - itemsCalculadora length:', presupuestoSeleccionado?.itemsCalculadora?.length);

    if (!presupuestoSeleccionado || !presupuestoSeleccionado.itemsCalculadora || presupuestoSeleccionado.itemsCalculadora.length === 0) {
      console.log('❌ NO HAY itemsCalculadora - retornando array vacío');
      return [];
    }

    console.log('✅ SÍ HAY itemsCalculadora - RETORNANDO SIN AGRUPAR (ya vienen consolidados del backend)');

    // NO AGRUPAR - los items ya vienen consolidados con sus totales calculados
    const items = presupuestoSeleccionado.itemsCalculadora.map(item => ({
      ...item,
      // Asegurar que los totales estén calculados desde los arrays si no vienen del backend
      subtotalJornales: item.subtotalJornales || (item.jornales || []).reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0),
      subtotalManoObra: item.subtotalManoObra || (item.profesionales || []).reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0),
      subtotalMateriales: item.subtotalMateriales || (item.materialesLista || []).reduce((sum, m) => sum + (Number(m.subtotal) || 0), 0),
      subtotalGastosGenerales: item.subtotalGastosGenerales || (item.gastosGenerales || []).reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0),
    }));

    console.log('✅ ITEMS SIN AGRUPAR:', items.length, 'items');
    items.forEach((g, i) => {
      console.log(`  ${i+1}. ${g.tipoProfesional}: $${Number(g.total || 0).toLocaleString('es-AR')}`);
    });

    return items;
  }, [presupuestoSeleccionado]);

  // Estados para filtros de búsqueda
  const [filtros, setFiltros] = useState({
    // Dirección de Obra
    direccionObraBarrio: '',
    direccionObraCalle: '',
    direccionObraAltura: '',
    direccionObraTorre: '',
    direccionObraPiso: '',
    direccionObraDepartamento: '',
    // Solicitante
    nombreSolicitante: '',
    telefono: '',
    mail: '',
    direccionParticular: '',
    // Presupuesto
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
  });

  // Estados para opciones de visualización
  const [mostrarTotalGastado, setMostrarTotalGastado] = useState(true);
  const [mostrarHonorarios, setMostrarHonorarios] = useState(false); // Por defecto NO mostrar desglose

  // Estados para controlar visibilidad de bloques en PDF
  const [mostrarBloqueImportarItems, setMostrarBloqueImportarItems] = useState(true);
  const [mostrarBloqueMetrosCuadrados, setMostrarBloqueMetrosCuadrados] = useState(true);
  const [mostrarBloqueItemsPresupuesto, setMostrarBloqueItemsPresupuesto] = useState(true);
  const [mostrarBloqueMayoresCostos, setMostrarBloqueMayoresCostos] = useState(true);
  const [mostrarBloqueConfigPresupuesto, setMostrarBloqueConfigPresupuesto] = useState(true);
  const [mostrarBloqueHonorarios, setMostrarBloqueHonorarios] = useState(true);

  // Estados para bloques colapsables (expandir/contraer)
  const [mostrarMetrosCuadrados, setMostrarMetrosCuadrados] = useState(false);
  const [mostrarItemsPresupuesto, setMostrarItemsPresupuesto] = useState(false);
  const [mostrarMayoresCostos, setMostrarMayoresCostos] = useState(false);
  const [mostrarConfigPresupuesto, setMostrarConfigPresupuesto] = useState(false);
  const [mostrarImportarItems, setMostrarImportarItems] = useState(false);
  const [mostrarConfiguracionProfesionales, setMostrarConfiguracionProfesionales] = useState(true); // ← ABIERTO POR DEFECTO

  // Estados para gestión de PDFs
  const [archivosPDF, setArchivosPDF] = useState([]);
  const [cargandoPDFs, setCargandoPDFs] = useState(false);
  const [subiendoPDF, setSubiendoPDF] = useState(false);

  // Estados para cálculo de metros cuadrados
  const [metrosCuadrados, setMetrosCuadrados] = useState('');
  const [importePorMetro, setImportePorMetro] = useState('');

  // Estados para sección de configuración de profesional con cálculos
  const [tipoProfesional, setTipoProfesional] = useState('');
  const [cantidadJornales, setCantidadJornales] = useState('');
  const [importeJornal, setImporteJornal] = useState('');
  const [importeMateriales, setImporteMateriales] = useState('');
  const [totalManual, setTotalManual] = useState('');

  // Cálculos automáticos
  const subtotalManoObra = cantidadJornales && importeJornal
    ? (Number(cantidadJornales) * Number(importeJornal))
    : 0;

  const totalCalculado = cantidadJornales && importeJornal && importeMateriales
    ? (subtotalManoObra + Number(importeMateriales))
    : 0;

  // Función para formatear fechas sin problemas de zona horaria
  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    // Si la fecha es en formato YYYY-MM-DD, separar y crear fecha local
    const partes = fecha.split('-');
    if (partes.length === 3) {
      const [año, mes, dia] = partes;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${año}`;
    }
    // Si es ISO completo, usar toLocaleDateString
    return new Date(fecha).toLocaleDateString('es-AR');
  };

  useEffect(() => {
    if (show && empresaSeleccionada) {
      console.log('🚀 Modal abierto, empresa seleccionada:', empresaSeleccionada);

      // Si hay un presupuesto preseleccionado, cargarlo directamente
      if (presupuestoPreseleccionado) {
        console.log('✅ Presupuesto preseleccionado detectado:', presupuestoPreseleccionado);
        seleccionarPresupuesto(presupuestoPreseleccionado);
      } else {
        // Si no hay preselección, cargar lista completa
        cargarPresupuestos();
      }
    }
  }, [show, empresaSeleccionada, presupuestoPreseleccionado]);

  const cargarPresupuestos = async () => {
    setLoading(true);
    try {
      console.log('📡 Llamando a API para cargar presupuestos...');
      const datos = await apiService.presupuestosNoCliente.getAll();
      console.log('📡 Respuesta de API:', datos);
      const lista = Array.isArray(datos) ? datos : (datos.datos || datos.content || []);

      // Ordenar primero por fecha de creación (más recientes primero), luego por versión (descendente)
      const listaOrdenada = lista.sort((a, b) => {
        // Primero comparar por fecha
        const fechaA = new Date(a.fechaCreacion || a.fechaEmision || 0);
        const fechaB = new Date(b.fechaCreacion || b.fechaEmision || 0);

        // Si las fechas son diferentes, ordenar por fecha descendente
        if (fechaB.getTime() !== fechaA.getTime()) {
          return fechaB - fechaA; // Más recientes primero
        }

        // Si las fechas son iguales, ordenar por versión descendente (mayor versión primero)
        const versionA = a.version || 0;
        const versionB = b.version || 0;
        return versionB - versionA; // Versión mayor primero
      });

      console.log('📤 Presupuestos cargados y ordenados:', listaOrdenada.length, 'items');
      console.log('📤 Más reciente:', listaOrdenada[0]);

      // DEBUG: Mostrar detalles de todos los presupuestos para verificar ID vs Versión
      console.log('🔍 DETALLE DE PRESUPUESTOS CARGADOS:');
      listaOrdenada.forEach((p, index) => {
        console.log(`  ${index + 1}. ID: ${p.id} | Nro: ${p.numeroPresupuesto} | Versión: ${p.numeroVersion || p.version} | Fecha: ${p.fechaCreacion || p.fechaEmision}`);
      });

      setPresupuestos(listaOrdenada);
    } catch (error) {
      console.error('❌ Error al cargar presupuestos:', error);
      alert('Error al cargar presupuestos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Funciones para manejar filtros
  const handleChangeFiltro = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      direccionObraBarrio: '',
      direccionObraCalle: '',
      direccionObraAltura: '',
      direccionObraTorre: '',
      direccionObraPiso: '',
      direccionObraDepartamento: '',
      nombreSolicitante: '',
      telefono: '',
      mail: '',
      direccionParticular: '',
      numeroPresupuesto: '',
      estado: '',
      numeroVersion: '',
      descripcion: '',
      fechaEmisionDesde: '',
      fechaEmisionHasta: '',
      fechaCreacionDesde: '',
      fechaCreacionHasta: '',
      fechaProbableInicioDesde: '',
      fechaProbableInicioHasta: '',
      vencimientoDesde: '',
      vencimientoHasta: '',
      totalGeneralMinimo: '',
      totalGeneralMaximo: '',
      totalProfesionalesMinimo: '',
      totalProfesionalesMaximo: '',
      totalMaterialesMinimo: '',
      totalMaterialesMaximo: '',
      tipoProfesionalPresupuesto: '',
      modoPresupuesto: ''
    });
  };

  const aplicarFiltros = (e) => {
    if (e) e.preventDefault();
    setMostrarFormularioFiltros(false);
  };

  // Aplicar filtros automáticamente cuando cambian
  React.useEffect(() => {
    if (!mostrarFormularioFiltros) {
      // Si estamos en la vista de resultados, los filtros ya están aplicándose automáticamente
      // mediante presupuestosFiltrados
    }
  }, [filtros, mostrarFormularioFiltros]);

  const mostrarTodos = () => {
    limpiarFiltros();
    setMostrarFormularioFiltros(false);
  };

  const volverAFiltros = () => {
    setMostrarFormularioFiltros(true);
    setPresupuestoSeleccionado(null);
    setMostrarPrevisualizacion(false);
  };

  // Obtener presupuestos filtrados
  const presupuestosFiltrados = presupuestos.filter(presupuesto => {
    // Si no hay filtros activos, mostrar todos
    const hayFiltros = Object.values(filtros).some(v => v !== '');
    if (!hayFiltros) return true;

    // Helper para dividir valores por coma o salto de línea y limpiar espacios
    const splitValues = (valor) => valor.split(/,|\n/).map(v => v.trim()).filter(v => v);

    // Filtros multi-valor (texto)
    const multiTextFields = [
      ['direccionObraBarrio', 'direccionObraBarrio'],
      ['direccionObraCalle', 'direccionObraCalle'],
      ['direccionObraAltura', 'direccionObraAltura'],
      ['direccionObraTorre', 'direccionObraTorre'],
      ['direccionObraPiso', 'direccionObraPiso'],
      ['direccionObraDepartamento', 'direccionObraDepartamento'],
      ['nombreSolicitante', 'nombreSolicitante'],
      ['telefono', 'telefono'],
      ['mail', 'mail'],
      ['direccionParticular', 'direccionParticular'],
      ['descripcion', 'descripcion'],
      ['tipoProfesionalPresupuesto', 'tipoProfesionalPresupuesto'],
      ['modoPresupuesto', 'modoPresupuesto']
    ];

    for (const [filtroKey, presupuestoKey] of multiTextFields) {
      if (filtros[filtroKey]) {
        const valores = splitValues(filtros[filtroKey].toLowerCase());
        const valorPresupuesto = (presupuesto[presupuestoKey] || '').toString().toLowerCase();
        // Si ninguno de los valores coincide, excluir
        if (!valores.some(v => valorPresupuesto.includes(v))) return false;
      }
    }

    // Filtros numéricos exactos
    if (filtros.numeroPresupuesto) {
      const valores = splitValues(filtros.numeroPresupuesto);
      if (!valores.some(v => presupuesto.numeroPresupuesto === parseInt(v))) return false;
    }
    if (filtros.numeroVersion) {
      const valores = splitValues(filtros.numeroVersion);
      if (!valores.some(v => presupuesto.version === parseInt(v) || presupuesto.numeroVersion === parseInt(v))) return false;
    }

    // Filtros de estado (multi-valor)
    if (filtros.estado) {
      const valores = splitValues(filtros.estado.toUpperCase());
      if (!valores.some(v => (presupuesto.estado || '').toUpperCase() === v)) return false;
    }

    // Filtros de fechas (rangos)
    if (filtros.fechaEmisionDesde && new Date(presupuesto.fechaEmision) < new Date(filtros.fechaEmisionDesde)) return false;
    if (filtros.fechaEmisionHasta && new Date(presupuesto.fechaEmision) > new Date(filtros.fechaEmisionHasta)) return false;
    if (filtros.fechaCreacionDesde && new Date(presupuesto.fechaCreacion) < new Date(filtros.fechaCreacionDesde)) return false;
    if (filtros.fechaCreacionHasta && new Date(presupuesto.fechaCreacion) > new Date(filtros.fechaCreacionHasta)) return false;
    if (filtros.fechaProbableInicioDesde && new Date(presupuesto.fechaProbableInicio) < new Date(filtros.fechaProbableInicioDesde)) return false;
    if (filtros.fechaProbableInicioHasta && new Date(presupuesto.fechaProbableInicio) > new Date(filtros.fechaProbableInicioHasta)) return false;
    if (filtros.vencimientoDesde && new Date(presupuesto.vencimiento) < new Date(filtros.vencimientoDesde)) return false;
    if (filtros.vencimientoHasta && new Date(presupuesto.vencimiento) > new Date(filtros.vencimientoHasta)) return false;

    // Filtros de montos (rangos)
    if (filtros.totalGeneralMinimo && presupuesto.montoTotal < parseFloat(filtros.totalGeneralMinimo)) return false;
    if (filtros.totalGeneralMaximo && presupuesto.montoTotal > parseFloat(filtros.totalGeneralMaximo)) return false;
    if (filtros.totalProfesionalesMinimo && presupuesto.totalProfesionales < parseFloat(filtros.totalProfesionalesMinimo)) return false;
    if (filtros.totalProfesionalesMaximo && presupuesto.totalProfesionales > parseFloat(filtros.totalProfesionalesMaximo)) return false;
    if (filtros.totalMaterialesMinimo && presupuesto.totalMateriales < parseFloat(filtros.totalMaterialesMinimo)) return false;
    if (filtros.totalMaterialesMaximo && presupuesto.totalMateriales > parseFloat(filtros.totalMaterialesMaximo)) return false;

    return true;
  });

  const seleccionarPresupuesto = async (presupuesto) => {
    setLoading(true);
    try {
      // DEBUG: Verificar qué presupuesto se está seleccionando
      console.log('🔍 SELECCIÓN DE PRESUPUESTO:');
      console.log('  - ID:', presupuesto.id);
      console.log('  - Número Presupuesto:', presupuesto.numeroPresupuesto);
      console.log('  - Versión:', presupuesto.numeroVersion || presupuesto.version);

      let datosCompletos;

      // Si el presupuesto ya tiene todos los datos (viene preseleccionado desde la tabla),
      // no necesitamos volver a consultar el backend
      const tieneDetallesCompletos = presupuesto.profesionales || presupuesto.materialesList || presupuesto.materiales;

      if (tieneDetallesCompletos) {
        console.log('✅ Presupuesto ya tiene detalles completos, usando directamente');
        datosCompletos = presupuesto;
      } else {
        console.log('📡 Cargando detalles completos del presupuesto desde backend...');
        datosCompletos = await apiService.presupuestosNoCliente.getById(presupuesto.id, empresaSeleccionada.id);
      }

      // 🔍 DEBUG CRÍTICO: Ver si itemsCalculadora viene del backend
      console.log('🔥 DEBUG MODAL ENVÍO - DATOS DEL BACKEND:');
      console.log('  - itemsCalculadora:', datosCompletos.itemsCalculadora);
      console.log('  - itemsCalculadora existe?:', !!datosCompletos.itemsCalculadora);
      console.log('  - itemsCalculadora es array?:', Array.isArray(datosCompletos.itemsCalculadora));
      console.log('  - itemsCalculadora length:', datosCompletos.itemsCalculadora?.length);
      console.log('  - itemsCalculadora[0]:', datosCompletos.itemsCalculadora?.[0]);
      console.log('  - TODAS LAS KEYS:', Object.keys(datosCompletos));

      console.log('📋 Presupuesto a procesar:');
      console.log('  - ID:', datosCompletos.id);
      console.log('  - Número:', datosCompletos.numeroPresupuesto);
      console.log('  - Versión:', datosCompletos.numeroVersion || datosCompletos.version);
      console.log('  - 📅 FECHA CREACIÓN:', datosCompletos.fechaCreacion);
      console.log('  - 📅 FECHA EMISIÓN:', datosCompletos.fechaEmision);
      console.log('  - 📅 FECHA PROBABLE INICIO:', datosCompletos.fechaProbableInicio);
      console.log('  - 📅 VENCIMIENTO:', datosCompletos.vencimiento);
      console.log('📧 Campo mail del presupuesto:', datosCompletos.mail);
      console.log('📧 ¿Tiene mail?', !!datosCompletos.mail);

      setPresupuestoSeleccionado(datosCompletos);
      setMostrarPrevisualizacion(true);
      setMostrarFormularioFiltros(false);

      // Cargar PDFs asociados al presupuesto
      await cargarPDFs(presupuesto.id);
      console.log('�📋 Profesionales RAW:', JSON.stringify(datosCompletos.profesionales, null, 2));
      console.log('📋 Configuraciones:', {
        profesionales: datosCompletos.configuracionesProfesionales,
        materiales: datosCompletos.configuracionesMateriales,
        otros: datosCompletos.configuracionesOtros
      });

      // Calcular totales para la previsualización
      // 🆕 SOPORTE PARA NUEVA ESTRUCTURA: itemsCalculadora (grupos de tareas)
      let totalProfesionales = 0;
      let totalMateriales = 0;
      let totalOtros = 0;

      // 1️⃣ Intentar calcular desde itemsCalculadora (nueva estructura)
      if (datosCompletos.itemsCalculadora && Array.isArray(datosCompletos.itemsCalculadora) && datosCompletos.itemsCalculadora.length > 0) {
        console.log('✅ Usando itemsCalculadora (grupos de tareas)');

        datosCompletos.itemsCalculadora.forEach(item => {
          // Sumar jornales (profesionales)
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              const subtotal = Number(prof.subtotal || prof.importeCalculado || 0);
              totalProfesionales += subtotal;
            });
          }

          // Sumar materiales
          if (item.materialesLista && Array.isArray(item.materialesLista)) {
            item.materialesLista.forEach(mat => {
              const subtotal = Number(mat.subtotal || 0);
              totalMateriales += subtotal;
            });
          }

          // Sumar gastos generales (otros costos)
          if (item.gastosGenerales && Array.isArray(item.gastosGenerales)) {
            item.gastosGenerales.forEach(gasto => {
              const subtotal = Number(gasto.subtotal || gasto.importe || 0);
              totalOtros += subtotal;
            });
          }
        });
      } else {
        console.log('⚠️ No hay itemsCalculadora, usando estructura antigua');

        // 2️⃣ Fallback a estructura antigua
        totalProfesionales = (datosCompletos.profesionales || []).reduce((sum, p) => {
          const importe = Number(
            p.subtotal ||  // ← El backend envía este campo
            p.importeCalculado ||
            p.importe_calculado ||
            p.importeTotal ||
            p.importe_total ||
            // Si no existe, calcular manualmente
            ((Number(p.cantidadHoras || p.cantidad_horas || 0)) * (Number(p.importeHora || p.importe_hora || p.importeXHora || p.importe_x_hora || 0)))
          );
          return sum + importe;
        }, 0);

        totalMateriales = (datosCompletos.materialesList || datosCompletos.materiales || []).reduce((sum, m) => {
          const subtotal = Number(m.cantidad || 0) * Number(m.precioUnitario || m.precio_unitario || 0);
          return sum + subtotal;
        }, 0);

        totalOtros = (datosCompletos.otrosCostos || datosCompletos.otros_costos || []).reduce((sum, o) => {
          return sum + Number(o.importe || 0);
        }, 0);
      }

      const montoTotal = totalProfesionales + totalMateriales + totalOtros;

      console.log('💵 Totales gastados:', {
        profesionales: totalProfesionales,
        materiales: totalMateriales,
        otros: totalOtros,
        total: montoTotal
      });

      // El "presupuesto" base viene directamente del backend como totalGeneral
      // Si no existe, usar el total calculado
      const totalPresupuesto = Number(datosCompletos.totalGeneral || datosCompletos.totalPresupuestoConHonorarios || datosCompletos.totalPresupuesto || montoTotal || 0);

      console.log('📊 Total presupuestado (base del backend):', totalPresupuesto);

      // Calcular honorarios
      let totalHonorarios = 0;
      let honorariosDesglosados = null;

      // DEBUG: Ver TODO el objeto que viene del backend
      console.log('📦 OBJETO COMPLETO del backend:', datosCompletos);
      console.log('📦 KEYS del objeto:', Object.keys(datosCompletos));

      // DEBUG: Ver qué campos de honorarios vienen del backend
      console.log('🔍 Campos de honorarios del backend:', {
        aplicarATodos: datosCompletos.honorariosAplicarATodos || datosCompletos.honorarios_aplicar_a_todos,
        valorGeneral: datosCompletos.honorariosValorGeneral || datosCompletos.honorarios_valor_general,
        tipoGeneral: datosCompletos.honorariosTipoGeneral || datosCompletos.honorarios_tipo_general,
        profesionalesActivo: datosCompletos.honorariosProfesionalesActivo || datosCompletos.honorarios_profesionales_activo,
        profesionalesTipo: datosCompletos.honorariosProfesionalesTipo || datosCompletos.honorarios_profesionales_tipo,
        profesionalesValor: datosCompletos.honorariosProfesionalesValor || datosCompletos.honorarios_profesionales_valor,
        materialesActivo: datosCompletos.honorariosMaterialesActivo || datosCompletos.honorarios_materiales_activo,
        materialesTipo: datosCompletos.honorariosMaterialesTipo || datosCompletos.honorarios_materiales_tipo,
        materialesValor: datosCompletos.honorariosMaterialesValor || datosCompletos.honorarios_materiales_valor,
        otrosActivo: datosCompletos.honorariosOtrosCostosActivo || datosCompletos.honorarios_otros_costos_activo,
        otrosTipo: datosCompletos.honorariosOtrosCostosTipo || datosCompletos.honorarios_otros_costos_tipo,
        otrosValor: datosCompletos.honorariosOtrosCostosValor || datosCompletos.honorarios_otros_costos_valor
      });

      // Verificar si tiene la nueva configuración de honorarios (probar ambas variantes: camelCase y snake_case)
      const tieneHonorarios =
        datosCompletos.honorariosAplicarATodos !== null || datosCompletos.honorarios_aplicar_a_todos !== null ||
        datosCompletos.honorariosProfesionalesActivo !== null || datosCompletos.honorarios_profesionales_activo !== null ||
        datosCompletos.honorariosMaterialesActivo !== null || datosCompletos.honorarios_materiales_activo !== null ||
        datosCompletos.honorariosOtrosCostosActivo !== null || datosCompletos.honorarios_otros_costos_activo !== null;

      if (tieneHonorarios) {

        console.log('💰 Detectada configuración de honorarios nueva');

        // Reconstruir objeto honorarios desde los campos individuales (probando camelCase y snake_case)
        const honorariosConfig = {
          aplicarATodos: datosCompletos.honorariosAplicarATodos ?? datosCompletos.honorarios_aplicar_a_todos ?? true,
          valorGeneral: datosCompletos.honorariosValorGeneral ?? datosCompletos.honorarios_valor_general ?? '',
          tipoGeneral: datosCompletos.honorariosTipoGeneral ?? datosCompletos.honorarios_tipo_general ?? 'porcentaje',
          profesionales: {
            activo: datosCompletos.honorariosProfesionalesActivo ?? datosCompletos.honorarios_profesionales_activo ?? false,
            tipo: datosCompletos.honorariosProfesionalesTipo ?? datosCompletos.honorarios_profesionales_tipo ?? 'porcentaje',
            valor: datosCompletos.honorariosProfesionalesValor ?? datosCompletos.honorarios_profesionales_valor ?? ''
          },
          materiales: {
            activo: datosCompletos.honorariosMaterialesActivo ?? datosCompletos.honorarios_materiales_activo ?? false,
            tipo: datosCompletos.honorariosMaterialesTipo ?? datosCompletos.honorarios_materiales_tipo ?? 'porcentaje',
            valor: datosCompletos.honorariosMaterialesValor ?? datosCompletos.honorarios_materiales_valor ?? ''
          },
          otrosCostos: {
            activo: datosCompletos.honorariosOtrosCostosActivo ?? datosCompletos.honorarios_otros_costos_activo ?? false,
            tipo: datosCompletos.honorariosOtrosCostosTipo ?? datosCompletos.honorarios_otros_costos_tipo ?? 'porcentaje',
            valor: datosCompletos.honorariosOtrosCostosValor ?? datosCompletos.honorarios_otros_costos_valor ?? ''
          }
        };

        console.log('🔧 Configuración de honorarios:', honorariosConfig);

        // Calcular honorarios con la nueva configuración
        honorariosDesglosados = {
          profesionales: 0,
          materiales: 0,
          otrosCostos: 0,
          total: 0
        };

        if (honorariosConfig.aplicarATodos && honorariosConfig.valorGeneral) {
          const valor = Number(honorariosConfig.valorGeneral);
          if (honorariosConfig.tipoGeneral === 'porcentaje') {
            honorariosDesglosados.profesionales = (totalProfesionales * valor) / 100;
            honorariosDesglosados.materiales = (totalMateriales * valor) / 100;
            honorariosDesglosados.otrosCostos = (totalOtros * valor) / 100;
          } else {
            honorariosDesglosados.profesionales = valor;
            honorariosDesglosados.materiales = valor;
            honorariosDesglosados.otrosCostos = valor;
          }
        } else {
          // Modo individual
          if (honorariosConfig.profesionales.activo && honorariosConfig.profesionales.valor) {
            const valor = Number(honorariosConfig.profesionales.valor);
            honorariosDesglosados.profesionales = honorariosConfig.profesionales.tipo === 'porcentaje'
              ? (totalProfesionales * valor) / 100
              : valor;
          }
          if (honorariosConfig.materiales.activo && honorariosConfig.materiales.valor) {
            const valor = Number(honorariosConfig.materiales.valor);
            honorariosDesglosados.materiales = honorariosConfig.materiales.tipo === 'porcentaje'
              ? (totalMateriales * valor) / 100
              : valor;
          }
          if (honorariosConfig.otrosCostos.activo && honorariosConfig.otrosCostos.valor) {
            const valor = Number(honorariosConfig.otrosCostos.valor);
            honorariosDesglosados.otrosCostos = honorariosConfig.otrosCostos.tipo === 'porcentaje'
              ? (totalOtros * valor) / 100
              : valor;
          }
        }

        honorariosDesglosados.total =
          honorariosDesglosados.profesionales +
          honorariosDesglosados.materiales +
          honorariosDesglosados.otrosCostos;

        totalHonorarios = honorariosDesglosados.total;

        console.log('💰 Honorarios calculados:', honorariosDesglosados);
      } else {
        // Fallback a honorarios legacy
        console.log('💰 Usando cálculo legacy de honorarios');
        if (datosCompletos.honorarioDireccionValorFijo && Number(datosCompletos.honorarioDireccionValorFijo) > 0) {
          totalHonorarios = Number(datosCompletos.honorarioDireccionValorFijo);
        } else if (datosCompletos.honorarioDireccionPorcentaje && Number(datosCompletos.honorarioDireccionPorcentaje) > 0) {
          totalHonorarios = (montoTotal * Number(datosCompletos.honorarioDireccionPorcentaje)) / 100;
        }
      }

      // Si tenemos honorarios desglosados, usar ese total
      if (honorariosDesglosados && honorariosDesglosados.total > 0) {
        totalHonorarios = honorariosDesglosados.total;
      }

      const totalPresupuestoConHonorarios = totalPresupuesto + totalHonorarios;

      console.log('💰 TOTALES FINALES:', {
        montoTotal,
        totalHonorarios,
        totalPresupuesto,
        totalPresupuestoConHonorarios,
        honorariosDesglosados
      });

      // Cargar datos de costos iniciales (metros cuadrados)
      const costosInicialesData = datosCompletos.costoInicial || datosCompletos.costosIniciales || null;
      console.log('📐 Costos iniciales (m²):', costosInicialesData);

      // Si hay configuración de metros cuadrados, usar esos montos como base
      let totalProfesionalesBase = totalProfesionales;
      let totalMaterialesBase = totalMateriales;
      let totalOtrosBase = totalOtros;
      let montoTotalBase = montoTotal;
      let totalPresupuestoBase = totalPresupuesto;

      if (costosInicialesData) {
        console.log('✅ Usando montos desde configuración de metros cuadrados');
        totalProfesionalesBase = costosInicialesData.montoProfesionales || 0;
        totalMaterialesBase = costosInicialesData.montoMateriales || 0;
        totalOtrosBase = costosInicialesData.montoOtrosCostos || 0;
        montoTotalBase = totalProfesionalesBase + totalMaterialesBase + totalOtrosBase;
        totalPresupuestoBase = montoTotalBase;

        console.log('📊 Totales desde m²:', {
          profesionales: totalProfesionalesBase,
          materiales: totalMaterialesBase,
          otros: totalOtrosBase,
          total: montoTotalBase
        });
      } else {
        console.log('ℹ️ Usando montos desde items agregados manualmente');
      }

      setPresupuestoSeleccionado({
        ...datosCompletos,
        montoTotal: montoTotalBase,
        totalProfesionales: totalProfesionalesBase, // Usar totales de m² si existen
        totalMateriales: totalMaterialesBase,
        totalOtros: totalOtrosBase,
        totalPresupuesto: totalPresupuestoBase,
        totalHonorarios,
        totalPresupuestoConHonorarios: totalPresupuestoBase + totalHonorarios,
        honorariosDesglosados, // Agregar desglose para mostrar en la UI
        costosIniciales: costosInicialesData, // Datos de metros cuadrados
        empresaNombre: datosCompletos.nombreEmpresa || empresaSeleccionada?.nombreEmpresa || 'Sin empresa'
      });
      setMostrarPrevisualizacion(true);
    } catch (error) {
      console.error('Error al cargar detalles del presupuesto:', error);
      alert('Error al cargar detalles del presupuesto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para generar mensaje compacto y completo
  const generarMensajePersonalizado = (p) => {
    const formatMoneda = (valor) => Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

    let msg = '📋 PRESUPUESTO\n';
    msg += '═'.repeat(35) + '\n\n';

    // Encabezado
    if (p.numeroPresupuesto) msg += `📄 Nº ${p.numeroPresupuesto} - v${p.numeroVersion || 1}\n`;
    if (p.fechaEmision) msg += `📅 ${new Date(p.fechaEmision).toLocaleDateString('es-AR')}\n`;
    if (p.estado) msg += `📊 ${p.estado.replace(/_/g, ' ')}\n`;
    msg += '\n';

    // Dirección
    if (p.direccionObraCalle || p.direccionObraAltura) {
      msg += '📍 OBRA\n';
      const dir = [p.direccionObraCalle, p.direccionObraAltura].filter(Boolean).join(' ');
      if (dir) msg += `${dir}\n`;
      if (p.direccionObraPiso || p.direccionObraDepartamento) {
        msg += `Piso ${p.direccionObraPiso || '-'} / Depto ${p.direccionObraDepartamento || '-'}\n`;
      }
      msg += '\n';
    }

    // Fechas
    msg += '📅 FECHAS\n';
    if (p.fechaProbableInicio) msg += `Inicio: ${new Date(p.fechaProbableInicio).toLocaleDateString('es-AR')}\n`;
    if (p.vencimiento) msg += `Vence: ${new Date(p.vencimiento).toLocaleDateString('es-AR')}\n`;
    if (p.tiempoEstimadoTerminacion) msg += `Duración: ${p.tiempoEstimadoTerminacion} días\n`;
    msg += '\n';

    msg += '─'.repeat(35) + '\n\n';

    // Profesionales
    if (p.profesionales && p.profesionales.length > 0) {
      msg += '👷 PROFESIONALES\n';
      p.profesionales.forEach((prof, i) => {
        const subtotal = Number(prof.subtotal || 0);
        msg += `${i + 1}. ${prof.tipoProfesional || 'Sin tipo'}\n`;
        msg += `   $${formatMoneda(subtotal)}\n`;
      });
      msg += `SUBTOTAL: $${formatMoneda(p.totalProfesionales)}\n\n`;
    }

    // Materiales
    if (p.materiales && p.materiales.length > 0) {
      msg += '🧱 MATERIALES\n';
      p.materiales.forEach((mat, i) => {
        const cant = Number(mat.cantidad || 0);
        const precio = Number(mat.precioUnitario || mat.precio_unitario || 0);
        const subtotal = cant * precio;
        msg += `${i + 1}. ${mat.tipoMaterial || mat.tipo_material || 'Sin nombre'}\n`;
        msg += `   ${cant} × $${formatMoneda(precio)} = $${formatMoneda(subtotal)}\n`;
      });
      msg += `SUBTOTAL: $${formatMoneda(p.totalMateriales)}\n\n`;
    }

    // Otros Costos
    if (p.otrosCostos && p.otrosCostos.length > 0) {
      msg += '💼 OTROS COSTOS\n';
      p.otrosCostos.forEach((costo, i) => {
        msg += `${i + 1}. ${costo.descripcion || 'Sin descripción'}\n`;
        msg += `   $${formatMoneda(costo.importe)}\n`;
      });
      msg += `SUBTOTAL: $${formatMoneda(p.totalOtros)}\n\n`;
    }

    msg += '═'.repeat(35) + '\n\n';

    // Base del Presupuesto
    msg += '💰 BASE DEL PRESUPUESTO\n';
    msg += `$${formatMoneda(p.montoTotal || 0)}\n\n`;
    msg += `• Profesionales: $${formatMoneda(p.totalProfesionales || 0)}\n`;
    msg += `• Materiales: $${formatMoneda(p.totalMateriales || 0)}\n`;
    msg += `• Otros: $${formatMoneda(p.totalOtros || 0)}\n\n`;

    // Honorarios (si existen)
    if (p.honorariosDesglosados && p.honorariosDesglosados.total > 0) {
      msg += '─'.repeat(35) + '\n\n';
      msg += '💼 HONORARIOS DE DIRECCIÓN\n';
      msg += `$${formatMoneda(p.honorariosDesglosados.total)}\n\n`;

      if (p.honorariosDesglosados.profesionales > 0) {
        msg += `• Sobre Profesionales: $${formatMoneda(p.honorariosDesglosados.profesionales)}\n`;
      }
      if (p.honorariosDesglosados.materiales > 0) {
        msg += `• Sobre Materiales: $${formatMoneda(p.honorariosDesglosados.materiales)}\n`;
      }
      if (p.honorariosDesglosados.otrosCostos > 0) {
        msg += `• Sobre Otros: $${formatMoneda(p.honorariosDesglosados.otrosCostos)}\n`;
      }
      msg += '\n';

      msg += '═'.repeat(35) + '\n\n';
      msg += '🏆 TOTAL FINAL\n';
      msg += `$${formatMoneda((p.montoTotal || 0) + p.honorariosDesglosados.total)}\n`;
      msg += '(Base + Honorarios)\n';
    } else {
      msg += '═'.repeat(35) + '\n\n';
      msg += '🏆 TOTAL FINAL\n';
      msg += `$${formatMoneda(p.montoTotal || 0)}\n`;
    }

    msg += '\n═'.repeat(35) + '\n';

    // Presupuestado vs Gastado
    if (p.totalPresupuesto > 0) {
      msg += '\n📊 CONTROL DE PRESUPUESTO\n';
      msg += `Presupuestado: $${formatMoneda(p.totalPresupuesto)}\n`;
      msg += `Total Gastado: $${formatMoneda(p.montoTotal)}\n`;

      const diferencia = p.totalPresupuesto - p.montoTotal;
      if (diferencia >= 0) {
        msg += `✅ Disponible: $${formatMoneda(diferencia)}\n`;
      } else {
        msg += `⚠️ Excedido: $${formatMoneda(Math.abs(diferencia))}\n`;
      }
    }

    return msg;
  };

  // Función para capturar el modal EXACTAMENTE como se ve
  // Nueva función para generar PDF real y seleccionable
  const generarPDFDirecto = async () => {
    if (!previewRef.current) {
      throw new Error('No se puede capturar el modal');
    }
    // Usar la función utilitaria para PDF real
    return await exportarAPDFReal(previewRef.current, `Presupuesto_${presupuestoSeleccionado.numeroPresupuesto || 'N-A'}_v${presupuestoSeleccionado.numeroVersion || 1}`);
  };

  // Funciones para gestionar PDFs
  const cargarPDFs = async (presupuestoId) => {
    if (!presupuestoId) {
      console.warn('⚠️ cargarPDFs: No hay presupuestoId');
      return;
    }

    console.log('🔍 Intentando cargar PDFs para presupuesto:', presupuestoId);
    console.log('🔍 URL:', `/v1/presupuestos-no-cliente/${presupuestoId}/pdfs`);
    console.log('🔍 empresaId:', empresaSeleccionada?.id);

    setCargandoPDFs(true);
    try {
      const response = await apiService.get(`/v1/presupuestos-no-cliente/${presupuestoId}/pdfs`, {
        params: { empresaId: empresaSeleccionada.id }
      });
      console.log('📦 Respuesta de PDFs:', response);
      console.log('📦 response.data:', response.data);
      console.log('📦 Cantidad de PDFs:', response.data?.length || 0);

      // El interceptor ya devuelve response.data, pero verificamos ambos casos
      const pdfs = response.data || response || [];
      console.log('📦 PDFs a usar:', pdfs);
      console.log('📦 Cantidad final:', pdfs.length);

      setArchivosPDF(pdfs);
      if (pdfs.length > 0) {
        console.log(`✅ ${pdfs.length} PDFs cargados para el presupuesto #${presupuestoId}`);
      } else {
        console.log('ℹ️ No se encontraron PDFs para este presupuesto');
      }
    } catch (error) {
      console.error('❌ Error al cargar PDFs:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      console.error('❌ Error message:', error.message);
      setArchivosPDF([]);
    } finally {
      setCargandoPDFs(false);
    }
  };

  const subirPDF = async (file) => {
    if (!presupuestoSeleccionado?.id) {
      alert('No hay presupuesto seleccionado');
      return;
    }

    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      alert('El archivo debe ser de tipo PDF');
      return;
    }

    // Validar tamaño (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('El archivo excede el tamaño máximo de 50MB');
      return;
    }

    setSubiendoPDF(true);
    console.log('📤 Intentando subir PDF:', {
      nombre: file.name,
      tamaño: file.size,
      tipo: file.type,
      presupuestoId: presupuestoSeleccionado.id
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nombre_archivo', file.name);
      formData.append('version_presupuesto', presupuestoSeleccionado.numeroVersion || 1);
      formData.append('incluye_honorarios', String(!mostrarHonorarios));
      formData.append('incluye_configuracion', 'true');

      console.log('📋 Datos a enviar:', {
        nombre_archivo: file.name,
        version_presupuesto: presupuestoSeleccionado.numeroVersion || 1,
        incluye_honorarios: !mostrarHonorarios,
        incluye_configuracion: true,
        empresaId: empresaSeleccionada.id
      });

      const response = await apiService.post(
        `/v1/presupuestos-no-cliente/${presupuestoSeleccionado.id}/pdf`,
        formData,
        {
          params: { empresaId: empresaSeleccionada.id }
        }
      );

      console.log('✅ PDF subido exitosamente:', response.data);
      alert(`✅ PDF "${file.name}" subido exitosamente al presupuesto #${presupuestoSeleccionado.numeroPresupuesto}`);

      // Recargar lista de PDFs
      await cargarPDFs(presupuestoSeleccionado.id);
    } catch (error) {
      console.error('❌ Error al subir PDF:', error);
      console.error('Detalles del error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      if (error.response?.status === 404) {
        alert('⚠️ El endpoint de subida de PDFs aún no está disponible en el backend.\n\nPor favor, contacta al equipo de backend para implementar:\nPOST /api/v1/presupuestos-no-cliente/{id}/pdf');
      } else if (error.response?.status === 500) {
        alert('❌ Error en el servidor:\n' + (error.response?.data?.message || 'Error interno del servidor'));
      } else {
        alert('❌ Error al subir el PDF: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setSubiendoPDF(false);
    }
  };

  const descargarPDF = async (pdfId, nombreArchivo) => {
    try {
      const response = await apiService.get(`/v1/presupuestos-no-cliente/pdf/${pdfId}`, {
        responseType: 'blob',
        params: { empresaId: empresaSeleccionada.id }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  const eliminarPDF = async (pdfId) => {
    if (!confirm('¿Está seguro que desea eliminar este PDF?')) {
      return;
    }

    try {
      await apiService.delete(`/v1/presupuestos-no-cliente/pdf/${pdfId}`, {
        params: { empresaId: empresaSeleccionada.id }
      });
      alert('✅ PDF eliminado exitosamente');
      await cargarPDFs(presupuestoSeleccionado.id);
    } catch (error) {
      console.error('Error al eliminar PDF:', error);
      alert('Error al eliminar el PDF');
    }
  };

  const formatearTamanio = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      subirPDF(file);
      // Limpiar el input para permitir subir el mismo archivo nuevamente
      event.target.value = '';
    }
  };

  // Cargar PDFs automáticamente cuando se selecciona un presupuesto
  useEffect(() => {
    if (presupuestoSeleccionado?.id) {
      console.log('📂 Cargando PDFs para presupuesto ID:', presupuestoSeleccionado.id);
      cargarPDFs(presupuestoSeleccionado.id);
    } else {
      // Limpiar lista si no hay presupuesto seleccionado
      setArchivosPDF([]);
    }
  }, [presupuestoSeleccionado?.id]);


  const enviarPorWhatsApp = async () => {
    setEnviando(true);
    console.log('🚀 Iniciando generación de IMAGEN...');

    try {
      console.log('📸 Capturando modal como imagen...');

      if (!previewRef.current) {
        throw new Error('No se puede capturar el modal');
      }

      // Generar imagen PNG con html2canvas
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        windowWidth: 1200,
        width: previewRef.current.scrollWidth,
        height: previewRef.current.scrollHeight
      });

      console.log('✅ Imagen generada:', canvas.width, 'x', canvas.height);

      // Convertir a blob y abrir en nueva ventana
      canvas.toBlob(async (blob) => {
        const imageUrl = URL.createObjectURL(blob);
        const nombreArchivo = `Presupuesto_${presupuestoSeleccionado.numeroPresupuesto || 'N-A'}_v${presupuestoSeleccionado.numeroVersion || 1}.png`;

        console.log('�️ Imagen lista, abriendo en nueva pestaña...');

      // Descargar el PDF NO - ahora generamos PNG
      // pdf.save(nombreArchivo);
      console.log('✅ Preparando para abrir ventana...');

      // Copiar un resumen breve al portapapeles
      const resumenBreve = `📋 *PRESUPUESTO Nº ${presupuestoSeleccionado.numeroPresupuesto || 'N/A'} - v${presupuestoSeleccionado.numeroVersion || 1}*\n\n` +
        `📍 Obra: ${presupuestoSeleccionado.direccionObraCalle || ''} ${presupuestoSeleccionado.direccionObraAltura || ''}\n` +
        `� Fecha: ${presupuestoSeleccionado.fechaEmision ? new Date(presupuestoSeleccionado.fechaEmision).toLocaleDateString('es-AR') : '-'}\n\n` +
        `💰 *TOTAL FINAL: $${((presupuestoSeleccionado.montoTotal || 0) + (presupuestoSeleccionado.honorariosDesglosados?.total || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}*`;

      try {
        await navigator.clipboard.writeText(resumenBreve);
        console.log('📋 Mensaje copiado al portapapeles');
      } catch (e) {
        console.warn('No se pudo copiar al portapapeles:', e);
      }

      // Crear página HTML con la imagen
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${nombreArchivo}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
                background-color: #f0f0f0;
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .instrucciones {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                max-width: 600px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .instrucciones h2 {
                margin-top: 0;
                color: #25D366;
              }
              .instrucciones ul {
                margin: 10px 0;
                padding-left: 20px;
              }
              .instrucciones li {
                margin: 8px 0;
              }
              .botones {
                display: flex;
                gap: 10px;
                margin: 15px 0;
                flex-wrap: wrap;
                justify-content: center;
              }
              button {
                padding: 12px 24px;
                font-size: 16px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                transition: transform 0.2s;
              }
              button:hover {
                transform: scale(1.05);
              }
              .btn-whatsapp {
                background-color: #25D366;
                color: white;
              }
              .btn-descargar {
                background-color: #007bff;
                color: white;
              }
              .btn-copiar {
                background-color: #6c757d;
                color: white;
              }
              .btn-copiar.copiado {
                background-color: #28a745;
              }
              .imagen-container {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 90%;
              }
              img {
                max-width: 100%;
                height: auto;
                display: block;
                border: 1px solid #ddd;
              }
              @media (max-width: 768px) {
                body {
                  padding: 10px;
                }
                .instrucciones {
                  padding: 15px;
                }
                button {
                  padding: 10px 20px;
                  font-size: 14px;
                }
              }
            </style>
          </head>
          <body>
            <div class="instrucciones">
              <h2>📱 Presupuesto Generado</h2>
              <div class="botones">
                <button class="btn-copiar" id="btnCopiar" onclick="copiarImagen()">
                  📋 Copiar Imagen

                <button class="btn-whatsapp" onclick="abrirWhatsApp()">
                  💬 Abrir WhatsApp Web
                </button>
                <button class="btn-descargar" onclick="descargarImagen()">
                  💾 Descargar Imagen
                </button>
              </div>
            </div>
            <div class="imagen-container">
              <img src="${imageUrl}" alt="Presupuesto" id="imagenPresupuesto">
            </div>
            <script>
              async function copiarImagen() {
                const btn = document.getElementById('btnCopiar');
                const img = document.getElementById('imagenPresupuesto');

                try {
                  // Convertir la imagen a blob
                  const response = await fetch(img.src);
                  const blob = await response.blob();

                  // Copiar al portapapeles
                  await navigator.clipboard.write([
                    new ClipboardItem({
                      [blob.type]: blob
                    })
                  ]);

                  // Feedback visual
                  btn.textContent = '✅ ¡Copiada!';
                  btn.classList.add('copiado');

                  setTimeout(() => {
                    btn.textContent = '📋 Copiar Imagen';
                    btn.classList.remove('copiado');
                  }, 2000);

                } catch (err) {
                  console.error('Error al copiar imagen:', err);
                  alert('No se pudo copiar la imagen. Intenta con click derecho → Copiar imagen');
                }
              }

              function abrirWhatsApp() {
                try {
                  // Intentar múltiples métodos para abrir WhatsApp
                  const url = 'https://web.whatsapp.com/';

                  // Método 1: window.open con noopener
                  const ventana = window.open(url, '_blank', 'noopener,noreferrer');

                  // Método 2: Si el método 1 falló (bloqueado por popup blocker)
                  if (!ventana || ventana.closed || typeof ventana.closed === 'undefined') {
                    // Crear un enlace temporal y hacer click
                    const a = document.createElement('a');
                    a.href = url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                } catch (err) {
                  console.error('Error al abrir WhatsApp:', err);
                  alert('No se pudo abrir WhatsApp Web automáticamente.\\n\\nPor favor, visita manualmente: https://web.whatsapp.com/');
                }
              }

              function descargarImagen() {
                const link = document.createElement('a');
                link.href = '${imageUrl}';
                link.download = '${nombreArchivo}';
                link.click();
              }
            </script>
          </body>
          </html>
        `);
        newWindow.document.close();
        console.log('✅ Ventana abierta con la imagen');
      }

      // Actualizar estado del presupuesto a ENVIADO
      await actualizarEstadoAEnviado();

      alert(
        '✅ Imagen generada!\n\n' +
        '📱 Se abrió en una nueva pestaña con la imagen del presupuesto\n' +
        '📋 Mensaje copiado al portapapeles\n\n' +
        'Instrucciones rápidas:\n' +
        '• Móvil: Mantén presionada la imagen → Compartir → WhatsApp\n' +
        '• PC: Click derecho en la imagen → Copiar → Pegar en WhatsApp\n' +
        '• O descarga y adjunta la imagen\n\n' +
        'La imagen se ve exactamente igual que en tu pantalla! 📱✨'
      );

      setTimeout(() => {
        setEnviando(false);
        console.log('🔔 Llamando onSuccess para cerrar modal de edición...');
        if (onSuccess) {
          onSuccess(); // Notificar a la página padre para cerrar modal de edición
        }
        cerrarTodo();
      }, 1000);
    }, 'image/png');

    } catch (error) {
      console.error('Error al generar imagen:', error);
      alert('Error al generar la imagen del presupuesto');
      setEnviando(false);
    }
  };

  const enviarPorEmail = async () => {
    setEnviando(true);
    try {
      // Preparar mensaje de email (sin destinatario, el usuario lo elegirá en su cliente)
      const asunto = `Presupuesto ${presupuestoSeleccionado.numeroPresupuesto || 'N/A'} - ${presupuestoSeleccionado.empresaNombre}`;
      const cuerpo = `Estimado/a,

Adjunto presupuesto Nº ${presupuestoSeleccionado.numeroPresupuesto || 'N/A'} versión ${presupuestoSeleccionado.numeroVersion || 1}.

Total: $${((presupuestoSeleccionado.montoTotal || 0) + (presupuestoSeleccionado.honorariosDesglosados?.total || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}

Por favor, revise la imagen adjunta para ver todos los detalles.

Saludos.`;

      // Capturar el modal como imagen PNG usando el ref
      const elemento = previewRef.current;
      if (!elemento) {
        throw new Error('No se pudo encontrar el elemento a capturar');
      }

      const canvas = await html2canvas(elemento, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Convertir canvas a blob PNG
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const nombreArchivo = `Presupuesto_${presupuestoSeleccionado.numeroPresupuesto || 'N-A'}_v${presupuestoSeleccionado.numeroVersion || 1}.png`;

        // Abrir ventana nueva con la imagen y opciones
        const ventana = window.open('', '_blank');
        ventana.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Presupuesto - Email</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
              body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              }
              .container-custom {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 30px;
                max-width: 900px;
                width: 100%;
              }
              .imagen-presupuesto {
                max-width: 100%;
                height: auto;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                margin-bottom: 25px;
              }
              .botones-accion {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 20px;
              }
              .btn-custom {
                padding: 15px 25px;
                font-size: 16px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
              }
              .btn-copiar {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .btn-copiar:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
              }
              .btn-email {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .btn-email:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(245, 87, 108, 0.4);
              }
              .btn-descargar {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
              }
              .btn-descargar:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(79, 172, 254, 0.4);
              }
              .titulo {
                text-align: center;
                color: #2d3748;
                margin-bottom: 25px;
                font-size: 28px;
                font-weight: 700;
              }
              .alerta-exito {
                background: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 20px;
                display: none;
                border-left: 4px solid #28a745;
              }
            </style>
          </head>
          <body>
            <div class="container-custom">
              <h1 class="titulo">
                <i class="fas fa-envelope"></i> Presupuesto para Email
              </h1>

              <div id="alerta-exito" class="alerta-exito">
                <i class="fas fa-check-circle"></i> <strong>¡Copiado!</strong> La imagen está lista para adjuntar en tu email.
              </div>

              <img src="${url}" alt="Presupuesto" class="imagen-presupuesto" id="imagen-presupuesto">

              <div class="botones-accion">
                <button class="btn-custom btn-copiar" onclick="copiarImagen()">
                  <i class="fas fa-copy"></i>
                  Copiar Imagen
                </button>

                <button class="btn-custom btn-email" onclick="abrirEmail()">
                  <i class="fas fa-envelope"></i>
                  Abrir Email
                </button>

                <button class="btn-custom btn-descargar" onclick="descargarImagen()">
                  <i class="fas fa-download"></i>
                  Descargar Imagen
                </button>
              </div>
            </div>

            <script>
              const asunto = \`${asunto}\`;
              const cuerpo = \`${cuerpo}\`;
              const nombreArchivo = '${nombreArchivo}';

              async function copiarImagen() {
                try {
                  const img = document.getElementById('imagen-presupuesto');
                  const response = await fetch(img.src);
                  const blob = await response.blob();

                  await navigator.clipboard.write([
                    new ClipboardItem({
                      'image/png': blob
                    })
                  ]);

                  // Mostrar alerta de éxito
                  const alerta = document.getElementById('alerta-exito');
                  alerta.style.display = 'block';
                  setTimeout(() => {
                    alerta.style.display = 'none';
                  }, 3000);
                } catch (err) {
                  alert('Error al copiar: ' + err.message);
                }
              }

              function abrirEmail() {
                try {
                  // Intentar múltiples proveedores de email
                  const emailOpciones = [
                    {
                      nombre: 'Gmail',
                      url: \`https://mail.google.com/mail/?view=cm&fs=1&su=\${encodeURIComponent(asunto)}&body=\${encodeURIComponent(cuerpo)}\`
                    },
                    {
                      nombre: 'Outlook',
                      url: \`https://outlook.live.com/mail/0/deeplink/compose?subject=\${encodeURIComponent(asunto)}&body=\${encodeURIComponent(cuerpo)}\`
                    },
                    {
                      nombre: 'Cliente de correo predeterminado',
                      url: \`mailto:?subject=\${encodeURIComponent(asunto)}&body=\${encodeURIComponent(cuerpo)}\`
                    }
                  ];

                  // Intentar abrir con el cliente de correo predeterminado primero
                  const mailtoUrl = emailOpciones[2].url;

                  // Método 1: Usar mailto (abrirá el cliente de correo predeterminado)
                  const ventana = window.open(mailtoUrl, '_blank', 'noopener,noreferrer');

                  // Si falla, mostrar opciones alternativas
                  setTimeout(() => {
                    if (!ventana || ventana.closed || typeof ventana.closed === 'undefined') {
                      // Mostrar opciones al usuario
                      const opcion = confirm(
                        'No se pudo abrir el cliente de correo automáticamente.\\n\\n' +
                        '¿Desea abrir Gmail Web en su lugar?\\n\\n' +
                        'OK = Gmail Web\\n' +
                        'Cancelar = Intentar con Outlook Web'
                      );

                      if (opcion) {
                        // Abrir Gmail
                        window.open(emailOpciones[0].url, '_blank', 'noopener,noreferrer');
                      } else {
                        // Abrir Outlook
                        window.open(emailOpciones[1].url, '_blank', 'noopener,noreferrer');
                      }
                    }
                  }, 500);

                } catch (err) {
                  console.error('Error al abrir email:', err);
                  alert('No se pudo abrir el cliente de correo automáticamente.\\n\\nPor favor, copie la imagen y envíela manualmente.');
                }
              }

              function descargarImagen() {
                const img = document.getElementById('imagen-presupuesto');
                const a = document.createElement('a');
                a.href = img.src;
                a.download = nombreArchivo;
                a.click();
              }
            </script>
          </body>
          </html>
        `);

        // Actualizar estado del presupuesto a ENVIADO (sin await porque toBlob no es async)
        actualizarEstadoAEnviado().then(() => {
          setEnviando(false);
          console.log('🔔 Llamando onSuccess para cerrar modal de edición...');
          if (onSuccess) {
            onSuccess(); // Notificar a la página padre para cerrar modal de edición
          }
        });
      }, 'image/png');

    } catch (error) {
      console.error('❌ Error al preparar email:', error);
      alert('Error al generar la imagen: ' + error.message);
      setEnviando(false);
    }
  };

  const volverALista = () => {
    setMostrarPrevisualizacion(false);
    setPresupuestoSeleccionado(null);
  };

  const actualizarEstadoAEnviado = async () => {
    try {
      console.log('📤 Actualizando estado del presupuesto a ENVIADO...');
      await apiService.presupuestosNoCliente.actualizarEstado(
        presupuestoSeleccionado.id,
        'ENVIADO',
        empresaSeleccionada.id
      );
      console.log('✅ Estado actualizado a ENVIADO');
    } catch (error) {
      console.error('❌ Error al actualizar estado:', error);
      // No mostramos error al usuario, es un proceso en segundo plano
    }
  };

  const cerrarTodo = () => {
    setMostrarPrevisualizacion(false);
    setPresupuestoSeleccionado(null);
    setPresupuestos([]);
    onClose();
  };

  if (!show) return null;
  console.log('🔴 Renderizando EnviarPresupuestoModal.jsx (cartel depuración debería verse)');
  return (
    <>
      {/* Cartel de alerta forzado para depuración, SIEMPRE visible al inicio del modal */}
      <div style={{margin: '30px 0', textAlign: 'center', color: '#fff', background: '#d9534f', border: '3px solid #b52a1a', borderRadius: '12px', padding: '24px', fontSize: '2rem', fontWeight: 'bold', zIndex: 9999}}>
        <span>🔴 CARTEL DE DEPURACIÓN: No se encontraron presupuestos con los filtros aplicados.</span>
      </div>
      {/* Modal de Lista de Presupuestos */}
      {!mostrarPrevisualizacion && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="fas fa-paper-plane me-2"></i>
                  Seleccionar Presupuesto para Enviar
                </h5>
                <button type="button" className="btn btn-light btn-sm ms-auto" onClick={cerrarTodo}>
                  Cerrar
                </button>
              </div>

              <div className="modal-body" style={{ paddingTop: '4rem' }}>
                {/* FORMULARIO DE FILTROS */}
                {mostrarFormularioFiltros ? (
                  <form onSubmit={aplicarFiltros}>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <div className="alert alert-primary mb-0 flex-grow-1 me-3">
                        <i className="fas fa-filter me-2"></i>
                        <strong>Filtrar Presupuestos</strong> - Filtra automáticamente mientras escribes. Haz clic en "Ver Resultados" para ver la tabla filtrada.
                        <br />
                        <span className="text-muted small">
                          <strong>Instrucciones:</strong> Todos los campos son opcionales. <u>Puedes ingresar varios valores en cada campo</u>, separados por coma o salto de línea (Ejemplo: <em>Calle1, Calle2, Calle3</em>). Los campos vacíos serán ignorados. Si escribes varios valores en un campo, se mostrarán los resultados que coincidan con <u>cualquiera</u> de esos valores. Los filtros de diferentes campos se combinan (deben cumplirse todos los criterios ingresados).<br />
                           <span style={{color: '#198754'}}><b>Tip:</b> Puedes buscar varias calles, barrios, estados, nombres, etc. al mismo tiempo.</span>
                         </span>
                       <div style={{margin: '20px 0', textAlign: 'center', color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '6px', padding: '12px'}}>
                         <strong>¡Atención!</strong> No se encontraron presupuestos con los filtros aplicados.
                       </div>
                      </div>
                      <button type="button" className="btn btn-success btn-lg" onClick={mostrarTodos}>
                        <i className="fas fa-list me-2"></i>Mostrar Todos
                      </button>
                    </div>

                    <div className="row g-3">
                      {/* 1. Dirección de la Obra */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="fas fa-map-marker-alt me-2"></i>1. Dirección de la Obra</h6>
                          </div>
                          <div className="card-body">
                            <div className="row g-3">
                              {/* Botón PDF original eliminado porque había un duplicado; se conserva la opción DOC y Excel */}
                              <div className="col-md-4">
                                <label className="form-label">Calle (puedes escribir varias, separadas por coma o salto de línea)</label>
                                <textarea className="form-control" name="direccionObraCalle" rows={2}
                                  value={filtros.direccionObraCalle} onChange={handleChangeFiltro} placeholder="Ej: Calle1, Calle2, Calle3" />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label">Altura (varias, separadas por coma o salto de línea)</label>
                                <textarea className="form-control" name="direccionObraAltura" rows={2}
                                  value={filtros.direccionObraAltura} onChange={handleChangeFiltro} placeholder="Ej: 100, 200, 300" />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label">Torre (varias, separadas por coma o salto de línea)</label>
                                <textarea className="form-control" name="direccionObraTorre" rows={2}
                                  value={filtros.direccionObraTorre} onChange={handleChangeFiltro} placeholder="Ej: A, B, 1" />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label">Piso (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="direccionObraPiso" rows={2}
                                  value={filtros.direccionObraPiso} onChange={handleChangeFiltro} placeholder="Ej: 1, 2, 3" />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label">Departamento (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="direccionObraDepartamento" rows={2}
                                  value={filtros.direccionObraDepartamento} onChange={handleChangeFiltro} placeholder="Ej: A, B, C" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Datos del Solicitante */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="fas fa-user me-2"></i>2. Datos del Solicitante</h6>
                          </div>
                          <div className="card-body">
                            <div className="row g-3">
                              <div className="col-md-6">
                                <label className="form-label">Nombre del Solicitante (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="nombreSolicitante" rows={2}
                                  value={filtros.nombreSolicitante} onChange={handleChangeFiltro} placeholder="Ej: Juan, Pedro, Ana" />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Teléfono (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="telefono" rows={2}
                                  value={filtros.telefono} onChange={handleChangeFiltro} placeholder="Ej: 123456, 789012" />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Email (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="mail" rows={2}
                                  value={filtros.mail} onChange={handleChangeFiltro} placeholder="Ej: mail1@mail.com, mail2@mail.com" />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Dirección Particular (varias, separadas por coma o salto de línea)</label>
                                <textarea className="form-control" name="direccionParticular" rows={2}
                                  value={filtros.direccionParticular} onChange={handleChangeFiltro} placeholder="Ej: Calle1 123, Calle2 456" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Datos del Presupuesto */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="fas fa-file-invoice-dollar me-2"></i>3. Datos del Presupuesto</h6>
                          </div>
                          <div className="card-body">
                            <div className="row g-3">
                              <div className="col-md-3">
                                <label className="form-label">Nº Presupuesto</label>
                                <input type="number" className="form-control" name="numeroPresupuesto"
                                       value={filtros.numeroPresupuesto} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label">Estado</label>
                                <select className="form-select" name="estado"
                                        value={filtros.estado} onChange={handleChangeFiltro}>
                                  <option value="">Todos</option>
                                  <option value="BORRADOR">BORRADOR</option>
                                  <option value="A_ENVIAR">A ENVIAR</option>
                                  <option value="ENVIADO">ENVIADO</option>
                                  <option value="MODIFICADO">MODIFICADO</option>
                                  <option value="APROBADO">APROBADO</option>
                                  <option value="OBRA_A_CONFIRMAR">OBRA A CONFIRMAR</option>
                                  <option value="EN_EJECUCION">EN EJECUCIÓN</option>
                                  <option value="SUSPENDIDA">SUSPENDIDA</option>
                                  <option value="TERMINADO">TERMINADO</option>
                                  <option value="CANCELADO">CANCELADO</option>
                                </select>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label">Nº Versión</label>
                                <input type="number" className="form-control" name="numeroVersion"
                                       value={filtros.numeroVersion} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label">Descripción (varias, separadas por coma o salto de línea)</label>
                                <textarea className="form-control" name="descripcion" rows={2}
                                  value={filtros.descripcion} onChange={handleChangeFiltro} placeholder="Ej: obra, reforma, ampliación" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Filtros por Fechas */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="fas fa-calendar-alt me-2"></i>4. Filtros por Fechas</h6>
                          </div>
                                                   <div className="card-body">
                            <div className="row g-3">
                              <div className="col-md-6">
                                <label className="form-label">Fecha Emisión Desde</label>
                                <input type="date" className="form-control" name="fechaEmisionDesde"
                                       value={filtros.fechaEmisionDesde} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Fecha Emisión Hasta</label>
                                <input type="date" className="form-control" name="fechaEmisionHasta"
                                       value={filtros.fechaEmisionHasta} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Fecha Creación Desde</label>
                                <input type="date" className="form-control" name="fechaCreacionDesde"
                                       value={filtros.fechaCreacionDesde} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Fecha Creación Hasta</label>
                                <input type="date" className="form-control" name="fechaCreacionHasta"
                                       value={filtros.fechaCreacionHasta} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Fecha Probable Inicio Desde</label>
                                <input type="date" className="form-control" name="fechaProbableInicioDesde"
                                       value={filtros.fechaProbableInicioDesde} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Fecha Probable Inicio Hasta</label>
                                <input type="date" className="form-control" name="fechaProbableInicioHasta"
                                       value={filtros.fechaProbableInicioHasta} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Vencimiento Desde</label>
                                <input type="date" className="form-control" name="vencimientoDesde"
                                       value={filtros.vencimientoDesde} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Vencimiento Hasta</label>
                                <input type="date" className="form-control" name="vencimientoHasta"
                                       value={filtros.vencimientoHasta} onChange={handleChangeFiltro} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 5. Filtros por Montos */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="fas fa-dollar-sign me-2"></i>5. Filtros por Montos</h6>
                          </div>
                          <div className="card-body">
                            <div className="row g-3">
                              <div className="col-md-6">
                                <label className="form-label">Total General Mínimo</label>
                                <input type="number" step="0.01" className="form-control" name="totalGeneralMinimo"
                                       value={filtros.totalGeneralMinimo} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Total General Máximo</label>
                                <input type="number" step="0.01" className="form-control" name="totalGeneralMaximo"
                                       value={filtros.totalGeneralMaximo} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Total Profesionales Mínimo</label>
                                <input type="number" step="0.01" className="form-control" name="totalProfesionalesMinimo"
                                       value={filtros.totalProfesionalesMinimo} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Total Profesionales Máximo</label>
                                <input type="number" step="0.01" className="form-control" name="totalProfesionalesMaximo"
                                       value={filtros.totalProfesionalesMaximo} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Total Materiales Mínimo</label>
                                <input type="number" step="0.01" className="form-control" name="totalMaterialesMinimo"
                                       value={filtros.totalMaterialesMinimo} onChange={handleChangeFiltro} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Total Materiales Máximo</label>
                                <input type="number" step="0.01" className="form-control" name="totalMaterialesMaximo"
                                       value={filtros.totalMaterialesMaximo} onChange={handleChangeFiltro} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6. Configuración */}
                      <div className="col-12">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0"><i className="fas fa-cog me-2"></i>6. Configuración</h6>
                          </div>
                          <div className="card-body">
                            <div className="row g-3">
                              <div className="col-md-6">
                                <label className="form-label">Tipo de Profesional del Presupuesto (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="tipoProfesionalPresupuesto" rows={2}
                                  value={filtros.tipoProfesionalPresupuesto} onChange={handleChangeFiltro} placeholder="Ej: Arquitecto, Ingeniero" />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label">Modo del Presupuesto (varios, separados por coma o salto de línea)</label>
                                <textarea className="form-control" name="modoPresupuesto" rows={2}
                                  value={filtros.modoPresupuesto} onChange={handleChangeFiltro} placeholder="Ej: DETALLADO, SIMPLE" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barra de botones flotante fija en la parte inferior */}
                    <div
                      style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#fff',
                        padding: '1rem 1.5rem',
                        borderRadius: '10px',
                        border: '2px solid #dee2e6',
                        zIndex: 10500,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        maxWidth: '90%'
                      }}
                    >
                      <div className="d-flex gap-2 justify-content-between align-items-center flex-wrap">
                        <div className="alert alert-info mb-0 py-2 px-3">
                          <i className="fas fa-info-circle me-2"></i>
                          <strong>{presupuestosFiltrados.length}</strong> presupuesto(s) encontrado(s)
                        </div>
                        <div className="d-flex gap-2">
                          <button type="button" className="btn btn-secondary" onClick={limpiarFiltros}>
                            <i className="fas fa-eraser me-2"></i>Limpiar Filtros
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={mostrarTodos}>
                            <i className="fas fa-list me-2"></i>Mostrar Todos
                          </button>
                          <button type="submit" className="btn btn-primary">
                            <i className="fas fa-eye me-2"></i>Ver Resultados
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Botones para volver a filtros y mostrar todos */}
                    <div className="mb-3 d-flex gap-2">
                      <button className="btn btn-outline-primary btn-sm" onClick={volverAFiltros}>
                        <i className="fas fa-arrow-left me-2"></i>Volver a Filtros
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" onClick={mostrarTodos}>
                        <i className="fas fa-list me-2"></i>Mostrar Todos
                      </button>
                    </div>

                    {/* Cartel de alerta forzado en la vista de resultados */}
                    <div style={{margin: '20px 0', textAlign: 'center', color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '6px', padding: '12px'}}>
                      <strong>¡Atención!</strong> No se encontraron presupuestos con los filtros aplicados.
                    </div>

                    {/* Información de ordenamiento */}
                    {!loading && presupuestosFiltrados.length > 0 && (
                      <div className="alert alert-info mb-3">
                        <i className="fas fa-info-circle me-2"></i>
                        <strong>Mostrando {presupuestosFiltrados.length} presupuesto(s)</strong>
                        {presupuestosFiltrados.length !== presupuestos.length &&
                          ` (filtrados de ${presupuestos.length} totales)`
                        }
                      </div>
                    )}

                    {loading ? (
                      <div className="text-center py-5">
                        <i className="fas fa-spinner fa-spin fa-3x text-primary"></i>
                        <p className="mt-3">Cargando presupuestos...</p>
                      </div>
                    ) : null}
                    {presupuestosFiltrados.length > 0 && (
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead className="table-success">
                            <tr>
                              <th>#</th>
                              <th>ID</th>
                              <th>Nº Presupuesto</th>
                              <th>Versión</th>
                              <th>Fecha</th>
                              <th>Solicitante</th>
                              <th>Dirección Obra</th>
                              <th>Estado</th>
                              <th>Contacto</th>
                              <th className="text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {presupuestosFiltrados.map((p, index) => (
                              <tr key={p.id} style={{
                                backgroundColor: index === 0 ? '#d4edda' : 'transparent'
                              }}>
                                <td>
                                  {index === 0 ? (
                                    <span className="badge bg-success">🆕 Último</span>
                                  ) : (
                                    <span className="text-muted">{index + 1}</span>
                                  )}
                                </td>
                                <td>
                                  <small className="text-muted">{p.id}</small>
                                </td>
                                <td><strong>{p.numeroPresupuesto || 'N/A'}</strong></td>
                                <td>
                                  <span className="badge bg-secondary">v{p.numeroVersion || p.version || 1}</span>
                                </td>
                                <td>
                                  <small>
                                    {p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString('es-AR') :
                                     p.fechaEmision ? new Date(p.fechaEmision).toLocaleDateString('es-AR') :
                                     'Sin fecha'}
                                  </small>
                                </td>
                                <td>{p.nombreSolicitante || 'Sin nombre'}</td>
                                <td>
                                  <small>
                                    {p.direccionObraCalle} {p.direccionObraAltura}
                                    {p.direccionObraBarrio && ` - ${p.direccionObraBarrio}`}
                                  </small>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    p.estado === 'A_ENVIAR' ? 'bg-success' :
                                    p.estado === 'MODIFICADO' ? 'bg-warning' :
                                    p.estado === 'BORRADOR' ? 'bg-secondary' :
                                    'bg-info'
                                  }`}>
                                    {p.estado?.replace('_', ' ') || 'N/A'}
                                  </span>
                                </td>
                                <td>
                                  <small>
                                    {p.telefono && (
                                      <div><i className="fab fa-whatsapp text-success me-1"></i> {p.telefono}</div>
                                    )}
                                    {p.mail && (
                                      <div><i className="fas fa-envelope text-primary me-1"></i> {p.mail}</div>
                                    )}
                                    {!p.telefono && !p.mail && (
                                      <span className="text-muted">Sin contacto</span>
                                    )}
                                  </small>
                                </td>
                                <td className="text-center">
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => seleccionarPresupuesto(p)}
                                    disabled={loading}
                                  >
                                    <i className="fas fa-eye me-1"></i>
                                    Ver y Enviar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarTodo}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Previsualización */}
      {mostrarPrevisualizacion && presupuestoSeleccionado && (
        <div className="modal show d-block" style={{ zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-fullscreen-md-down modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="fas fa-paper-plane me-2"></i>
                  Enviar Presupuesto #{presupuestoSeleccionado.numeroPresupuesto || 'N/A'} - v{presupuestoSeleccionado.numeroVersion || 1}
                </h5>
                <button
                  type="button"
                  className="btn btn-light btn-sm ms-auto"
                  onClick={volverALista}
                  disabled={enviando}
                >
                  Cerrar
                </button>
              </div>

              <div className="modal-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Opciones de visualización */}
                <div className="bg-light border-bottom p-3">
                  <h6 className="mb-2">
                    <i className="fas fa-cog me-2"></i>
                    Opciones de Visualización
                  </h6>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarTotalGastado"
                      checked={mostrarTotalGastado}
                      onChange={(e) => setMostrarTotalGastado(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarTotalGastado">
                      Incluir cuadro "Total Gastado" en el PDF
                    </label>
                  </div>
                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarHonorarios"
                      checked={mostrarHonorarios}
                      onChange={(e) => setMostrarHonorarios(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarHonorarios">
                      Incluir subtotales de honorarios (desglose por sección)
                    </label>
                  </div>

                  <hr className="my-3" />

                  <h6 className="mb-2 text-secondary">
                    <i className="fas fa-eye me-2"></i>
                    Bloques de Configuración a Mostrar
                  </h6>

                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarBloqueImportarItems"
                      checked={mostrarBloqueImportarItems}
                      onChange={(e) => setMostrarBloqueImportarItems(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarBloqueImportarItems">
                      📥 Importar desde Items Agregados
                    </label>
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarBloqueMetrosCuadrados"
                      checked={mostrarBloqueMetrosCuadrados}
                      onChange={(e) => setMostrarBloqueMetrosCuadrados(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarBloqueMetrosCuadrados">
                      📐 Cálculo Inicial por Metros Cuadrados
                    </label>
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarBloqueItemsPresupuesto"
                      checked={mostrarBloqueItemsPresupuesto}
                      onChange={(e) => setMostrarBloqueItemsPresupuesto(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarBloqueItemsPresupuesto">
                      📋 Items del Presupuesto
                    </label>
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarBloqueMayoresCostos"
                      checked={mostrarBloqueMayoresCostos}
                      onChange={(e) => setMostrarBloqueMayoresCostos(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarBloqueMayoresCostos">
                      💰 Mayores Costos
                    </label>
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarBloqueConfigPresupuesto"
                      checked={mostrarBloqueConfigPresupuesto}
                      onChange={(e) => setMostrarBloqueConfigPresupuesto(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarBloqueConfigPresupuesto">
                      ⚙️ Configuración del Presupuesto
                    </label>
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkMostrarBloqueHonorarios"
                      checked={mostrarBloqueHonorarios}
                      onChange={(e) => setMostrarBloqueHonorarios(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="checkMostrarBloqueHonorarios">
                      🧮 Honorarios
                    </label>
                  </div>
                </div>

                {/* Contenido Responsive - Con ref para captura */}
                <div ref={previewRef} className="container-fluid p-3 p-md-4" style={{ backgroundColor: '#ffffff' }}>

                  {/* Header con información clave */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="card border-success">
                        <div className="card-body">
                          <div className="row g-3">
                            <div className="col-12 col-md-6">
                              <h4 className="text-success mb-3">
                                <i className="fas fa-building me-2"></i>
                                {presupuestoSeleccionado.empresaNombre || 'Sin empresa'}
                              </h4>
                              <p className="mb-1">
                                <strong>Presupuesto Nº:</strong> {presupuestoSeleccionado.numeroPresupuesto || 'Nuevo'}
                              </p>
                              <p className="mb-1">
                                <strong>Versión:</strong> {presupuestoSeleccionado.numeroVersion || presupuestoSeleccionado.version || 1}
                              </p>
                              <p className="mb-0">
                                <strong>Estado:</strong>{' '}
                                <span className={`badge ${
                                  presupuestoSeleccionado.estado === 'A_ENVIAR' ? 'bg-success' :
                                  presupuestoSeleccionado.estado === 'MODIFICADO' ? 'bg-warning' :
                                  presupuestoSeleccionado.estado === 'BORRADOR' ? 'bg-secondary' :
                                  'bg-info'
                                }`}>
                                  {presupuestoSeleccionado.estado?.replace('_', ' ') || 'Borrador'}
                                </span>
                              </p>
                            </div>
                            <div className="col-12 col-md-6">
                              <p className="mb-1">
                                <strong>Solicitante:</strong> {presupuestoSeleccionado.nombreSolicitante || '-'}
                              </p>
                              <p className="mb-1">
                                <strong>Teléfono:</strong> {presupuestoSeleccionado.telefono || '-'}
                              </p>
                              <p className="mb-1">
                                <strong>Email:</strong> {presupuestoSeleccionado.mail || '-'}
                              </p>
                              <p className="mb-1">
                                <strong>Dirección Particular:</strong> {presupuestoSeleccionado.direccionParticular || '-'}
                              </p>
                              <p className="mb-1">
                                <strong>Fecha Creación:</strong> {formatearFecha(presupuestoSeleccionado.fechaCreacion)}
                              </p>
                              <p className="mb-0">
                                <strong>Fecha Emisión:</strong> {formatearFecha(presupuestoSeleccionado.fechaEmision)}
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
                          <strong>{presupuestoSeleccionado.direccionObraBarrio || '-'}</strong>
                        </div>
                        <div className="col-6 col-md-4 col-lg-3">
                          <small className="text-muted d-block">Calle</small>
                          <strong>{presupuestoSeleccionado.direccionObraCalle || '-'}</strong>
                        </div>
                        <div className="col-6 col-md-4 col-lg-2">
                          <small className="text-muted d-block">Altura</small>
                          <strong>{presupuestoSeleccionado.direccionObraAltura || '-'}</strong>
                        </div>
                        <div className="col-6 col-md-4 col-lg-2">
                          <small className="text-muted d-block">Torre</small>
                          <strong>{presupuestoSeleccionado.direccionObraTorre || '-'}</strong>
                        </div>
                        <div className="col-6 col-md-4 col-lg-2">
                          <small className="text-muted d-block">Piso / Depto</small>
                          <strong>{presupuestoSeleccionado.direccionObraPiso || '-'} / {presupuestoSeleccionado.direccionObraDepartamento || '-'}</strong>
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
                          <small className="text-muted d-block mb-1">Probable Inicio</small>
                          <strong>{formatearFecha(presupuestoSeleccionado.fechaProbableInicio)}</strong>
                        </div>
                        <div className="col-6 col-md-4">
                          <small className="text-muted d-block mb-1">Vencimiento</small>
                          <strong>{formatearFecha(presupuestoSeleccionado.vencimiento)}</strong>
                        </div>
                        <div className="col-6 col-md-4">
                          <small className="text-muted d-block mb-1">Tiempo Estimado</small>
                          <strong>{presupuestoSeleccionado.tiempoEstimadoTerminacion ? `${presupuestoSeleccionado.tiempoEstimadoTerminacion} días` : '-'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Descripción y Observaciones */}
                  {(presupuestoSeleccionado.descripcion || presupuestoSeleccionado.observaciones) && (
                    <div className="row mb-4">
                      <div className="col-12">
                        <h5 className="text-secondary border-bottom pb-2 mb-3">
                          <i className="fas fa-file-alt me-2"></i>
                          Descripción y Observaciones
                        </h5>
                        {presupuestoSeleccionado.descripcion && (
                          <div className="mb-2">
                            <strong className="text-muted">Descripción:</strong>
                            <p className="mb-1">{presupuestoSeleccionado.descripcion}</p>
                          </div>
                        )}
                        {presupuestoSeleccionado.observaciones && (
                          <div>
                            <strong className="text-muted">Observaciones:</strong>
                            <p className="mb-0">{presupuestoSeleccionado.observaciones}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cálculo por Metros Cuadrados */}
                  {mostrarBloqueMetrosCuadrados && presupuestoSeleccionado.costosIniciales && (
                    <div className="row mb-4">
                      <div className="col-12">
                        <div className="border rounded p-3" style={{backgroundColor: '#d4edda'}}>
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
                        <div className="card border-primary">
                          <div className="card-body">
                            {/* Datos Base */}
                            <div className="row mb-3">
                              <div className="col-md-4">
                                <div className="text-center p-3 bg-light rounded">
                                  <small className="text-muted d-block mb-1">Metros Cuadrados (m²)</small>
                                  <h4 className="mb-0 text-primary">{presupuestoSeleccionado.costosIniciales.metrosCuadrados}</h4>
                                </div>
                              </div>
                              <div className="col-md-4">
                                <div className="text-center p-3 bg-light rounded">
                                  <small className="text-muted d-block mb-1">Importe Promedio por m²</small>
                                  <h4 className="mb-0 text-success">${presupuestoSeleccionado.costosIniciales.importePorMetro.toLocaleString('es-AR')}</h4>
                                </div>
                              </div>
                              <div className="col-md-4">
                                <div className="text-center p-3 bg-primary bg-opacity-10 rounded">
                                  <small className="text-muted d-block mb-1">💰 Total Estimado Base</small>
                                  <h4 className="mb-0 text-primary fw-bold">${presupuestoSeleccionado.costosIniciales.totalEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h4>
                                </div>
                              </div>
                            </div>

                            {/* Distribución por Porcentajes */}
                            <div className="border-top pt-3">
                              <h6 className="mb-3"><i className="fas fa-chart-pie me-2"></i>Distribución por Porcentajes</h6>

                              <div className="row g-3">
                                {/* Profesionales */}
                                <div className="col-md-4">
                                  <div className="p-3 border rounded">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <span className="fw-bold">% Profesionales</span>
                                      <span className="badge bg-primary">{presupuestoSeleccionado.costosIniciales.porcentajeProfesionales}%</span>
                                    </div>
                                    <div className="text-end">
                                      <h5 className="mb-0 text-primary">💼 ${presupuestoSeleccionado.costosIniciales.montoProfesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h5>
                                    </div>
                                  </div>
                                </div>

                                {/* Materiales */}
                                <div className="col-md-4">
                                  <div className="p-3 border rounded">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <span className="fw-bold">% Materiales</span>
                                      <span className="badge bg-success">{presupuestoSeleccionado.costosIniciales.porcentajeMateriales}%</span>
                                    </div>
                                    <div className="text-end">
                                      <h5 className="mb-0 text-success">🧱 ${presupuestoSeleccionado.costosIniciales.montoMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h5>
                                    </div>
                                  </div>
                                </div>

                                {/* Otros Costos */}
                                <div className="col-md-4">
                                  <div className="p-3 border rounded">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <span className="fw-bold">% Otros Costos</span>
                                      <span className="badge bg-warning">{presupuestoSeleccionado.costosIniciales.porcentajeOtrosCostos}%</span>
                                    </div>
                                    <div className="text-end">
                                      <h5 className="mb-0 text-warning">📦 ${presupuestoSeleccionado.costosIniciales.montoOtrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h5>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Validación suma 100% */}
                              <div className="mt-3 text-center">
                                <span className="badge bg-success">
                                  ✅ Suma total: {presupuestoSeleccionado.costosIniciales.porcentajeProfesionales + presupuestoSeleccionado.costosIniciales.porcentajeMateriales + presupuestoSeleccionado.costosIniciales.porcentajeOtrosCostos}%
                                </span>
                              </div>

                              {/* Resumen */}
                              <div className="mt-3 p-3 bg-light rounded">
                                <h6 className="mb-2">📋 Datos Guardados:</h6>
                                <ul className="mb-0 small">
                                  <li>📐 {presupuestoSeleccionado.costosIniciales.metrosCuadrados} m² × ${presupuestoSeleccionado.costosIniciales.importePorMetro.toLocaleString('es-AR')}/m² = ${presupuestoSeleccionado.costosIniciales.totalEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>
                                  <li>💼 Profesionales ({presupuestoSeleccionado.costosIniciales.porcentajeProfesionales}%): ${presupuestoSeleccionado.costosIniciales.montoProfesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>
                                  <li>🧱 Materiales ({presupuestoSeleccionado.costosIniciales.porcentajeMateriales}%): ${presupuestoSeleccionado.costosIniciales.montoMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>
                                  <li>💼 Otros Costos ({presupuestoSeleccionado.costosIniciales.porcentajeOtrosCostos}%): ${presupuestoSeleccionado.costosIniciales.montoOtrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items del Presupuesto - Bloque Colapsable */}
                  {mostrarBloqueItemsPresupuesto && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="border rounded p-3" style={{backgroundColor: '#fff3cd'}}>
                        <h6
                          className="mb-3 text-warning"
                          style={{cursor: 'pointer', fontWeight: 'bold'}}
                          onClick={() => setMostrarItemsPresupuesto(!mostrarItemsPresupuesto)}
                        >
                          <i className="fas fa-list-ul me-2"></i>
                          📋 Configuración de Items del Presupuesto
                          <span className="ms-2 small">{mostrarItemsPresupuesto ? '▼' : '▶'}</span>
                        </h6>

                        {mostrarItemsPresupuesto && (
                          <div className="card">
                            <div className="card-body">

                  {/* Profesionales Detallados */}
                  {presupuestoSeleccionado.profesionales?.length > 0 && (
                    <div className="row mb-4">
                      <div className="col-12">
                        <h5 className="text-secondary border-bottom pb-2 mb-3">
                          <i className="fas fa-users me-2"></i>
                          Profesionales Asignados ({presupuestoSeleccionado.profesionales.length})
                        </h5>
                        <div className="table-responsive">
                          <table className="table table-sm table-hover table-bordered">
                            <thead className="table-primary">
                              <tr>
                                <th className="d-none d-md-table-cell">#</th>
                                <th>Tipo Profesional</th>
                                <th className="text-center">Cantidad</th>
                                <th className="text-end">Importe</th>
                                <th className="text-end">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {presupuestoSeleccionado.profesionales.map((prof, idx) => {
                                // Determinar modalidad y valores según qué campo tiene datos
                                let modo = '', cantidad = 0, importe = 0;

                                if (prof.cantidadHoras && prof.cantidadHoras > 0) {
                                  modo = 'Hora';
                                  cantidad = prof.cantidadHoras;
                                  importe = prof.importeHora || prof.importeXHora || prof.importe_hora || prof.importe_x_hora || 0;
                                } else if (prof.cantidadDias && prof.cantidadDias > 0) {
                                  modo = 'Día';
                                  cantidad = prof.cantidadDias;
                                  importe = prof.importeDia || prof.importeXDia || prof.importe_dia || prof.importe_x_dia || 0;
                                } else if (prof.cantidadSemanas && prof.cantidadSemanas > 0) {
                                  modo = 'Semana';
                                  cantidad = prof.cantidadSemanas;
                                  importe = prof.importeSemana || prof.importeXSemana || prof.importe_semana || prof.importe_x_semana || 0;
                                } else if (prof.cantidadMeses && prof.cantidadMeses > 0) {
                                  modo = 'Mes';
                                  cantidad = prof.cantidadMeses;
                                  importe = prof.importeMes || prof.importeXMes || prof.importe_mes || prof.importe_x_mes || 0;
                                }

                                // El backend envía "subtotal" como campo calculado
                                const subtotal = prof.subtotal || prof.importeCalculado || prof.importe_calculado || (cantidad * importe);

                                return (
                                  <tr key={idx}>
                                    <td className="d-none d-md-table-cell">{idx + 1}</td>
                                    <td>
                                      <strong>{prof.tipoProfesional || prof.tipo_profesional || '-'}</strong>
                                    </td>
                                    <td className="text-center">
                                      <span className="badge bg-info">{cantidad} {modo}{cantidad !== 1 ? 's' : ''}</span>
                                    </td>
                                    <td className="text-end">
                                      ${Number(importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-end">
                                      <strong>${Number(subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="table-info fw-bold">
                                <td colSpan="4" className="text-end">SUBTOTAL PROFESIONALES:</td>
                                <td className="text-end">
                                  ${(presupuestoSeleccionado.totalProfesionales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Materiales Detallados */}
                  {presupuestoSeleccionado.materialesList?.length > 0 && (
                    <div className="row mb-4">
                      <div className="col-12">
                        <h5 className="text-secondary border-bottom pb-2 mb-3">
                          <i className="fas fa-box me-2"></i>
                          Materiales ({presupuestoSeleccionado.materialesList.length})
                        </h5>
                        <div className="table-responsive">
                          <table className="table table-sm table-hover table-bordered">
                            <thead className="table-success">
                              <tr>
                                <th className="d-none d-md-table-cell">#</th>
                                <th>Tipo de Material</th>
                                <th className="text-center">Cantidad</th>
                                <th className="text-end">Precio Unit.</th>
                                <th className="text-end">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {presupuestoSeleccionado.materialesList.map((mat, idx) => {
                                const cantidad = Number(mat.cantidad || 0);
                                const precioUnit = Number(mat.precioUnitario || mat.precio_unitario || 0);
                                const subtotal = cantidad * precioUnit;

                                return (
                                  <tr key={idx}>
                                    <td className="d-none d-md-table-cell">{idx + 1}</td>
                                    <td>
                                      <strong>{mat.tipoMaterial || mat.tipo_material || '-'}</strong>
                                    </td>
                                    <td className="text-center">
                                      <span className="badge bg-success">{cantidad}</span>
                                    </td>
                                    <td className="text-end">
                                      ${precioUnit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-end">
                                      <strong>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="table-success fw-bold">
                                <td colSpan="4" className="text-end">SUBTOTAL MATERIALES:</td>
                                <td className="text-end">
                                  ${(presupuestoSeleccionado.totalMateriales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Otros Costos Detallados */}
                  {presupuestoSeleccionado.otrosCostos?.length > 0 && (
                    <div className="row mb-4">
                      <div className="col-12">
                        <h5 className="text-secondary border-bottom pb-2 mb-3">
                          <i className="fas fa-coins me-2"></i>
                          Otros Costos ({presupuestoSeleccionado.otrosCostos.length})
                        </h5>
                        <div className="table-responsive">
                          <table className="table table-sm table-hover table-bordered">
                            <thead className="table-warning">
                              <tr>
                                <th className="d-none d-md-table-cell">#</th>
                                <th>Descripción</th>
                                <th className="text-end">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {presupuestoSeleccionado.otrosCostos.map((costo, idx) => {
                                const importe = Number(costo.importe || 0);

                                return (
                                  <tr key={idx}>
                                    <td className="d-none d-md-table-cell">{idx + 1}</td>
                                    <td>
                                      <strong>{costo.descripcion || '-'}</strong>
                                    </td>
                                    <td className="text-end">
                                      <strong>${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="table-warning fw-bold">
                                <td colSpan="2" className="text-end">SUBTOTAL OTROS COSTOS:</td>
                                <td className="text-end">
                                  ${(presupuestoSeleccionado.totalOtros || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Mayores Costos - Bloque Colapsable */}
                  {mostrarBloqueMayoresCostos && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="border rounded p-3" style={{backgroundColor: '#cce5ff'}}>
                        <h6
                          className="mb-3 text-primary"
                          style={{cursor: 'pointer', fontWeight: 'bold'}}
                          onClick={() => setMostrarMayoresCostos(!mostrarMayoresCostos)}
                        >
                          <i className="fas fa-chart-line me-2"></i>
                          💰 Configuración de Mayores Costos
                          <span className="ms-2 small">{mostrarMayoresCostos ? '▼' : '▶'}</span>
                        </h6>

                        {mostrarMayoresCostos && (
                          <div className="card">
                            <div className="card-body">
                              {presupuestoSeleccionado.configuracionMayoresCostos ? (
                                <div className="alert alert-info">
                                  <i className="fas fa-info-circle me-2"></i>
                                  Este presupuesto tiene configuración de Mayores Costos aplicada
                                </div>
                              ) : (
                                <div className="alert alert-secondary mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  No se configuraron mayores costos para este presupuesto
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Configuración del Presupuesto - Bloque Colapsable */}
                  {mostrarBloqueConfigPresupuesto && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="border rounded p-3" style={{backgroundColor: '#e7d4f5'}}>
                        <h6
                          className="mb-3"
                          style={{cursor: 'pointer', fontWeight: 'bold', color: '#7b2cbf'}}
                          onClick={() => setMostrarConfigPresupuesto(!mostrarConfigPresupuesto)}
                        >
                          <i className="fas fa-cog me-2"></i>
                          ⚙️ Configuración del Presupuesto
                          <span className="ms-2 small">{mostrarConfigPresupuesto ? '▼' : '▶'}</span>
                        </h6>

                        {mostrarConfigPresupuesto && (
                          <div className="card">
                            <div className="card-body">
                              <div className="row g-3">
                                {presupuestoSeleccionado.empresa && (
                                  <div className="col-md-6">
                                    <div className="bg-light p-3 rounded">
                                      <small className="text-muted d-block mb-1"><i className="fas fa-building me-1"></i>Empresa</small>
                                      <strong>{presupuestoSeleccionado.empresa}</strong>
                                    </div>
                                  </div>
                                )}

                                {presupuestoSeleccionado.obra && (
                                  <div className="col-md-6">
                                    <div className="bg-light p-3 rounded">
                                      <small className="text-muted d-block mb-1"><i className="fas fa-hard-hat me-1"></i>Obra</small>
                                      <strong>{presupuestoSeleccionado.obra}</strong>
                                    </div>
                                  </div>
                                )}

                                {presupuestoSeleccionado.version && (
                                  <div className="col-md-6">
                                    <div className="bg-light p-3 rounded">
                                      <small className="text-muted d-block mb-1"><i className="fas fa-code-branch me-1"></i>Versión</small>
                                      <strong>{presupuestoSeleccionado.version}</strong>
                                    </div>
                                  </div>
                                )}

                                {presupuestoSeleccionado.fechaEnvio && (
                                  <div className="col-md-6">
                                    <div className="bg-light p-3 rounded">
                                      <small className="text-muted d-block mb-1"><i className="fas fa-calendar me-1"></i>Fecha de Envío</small>
                                      <strong>{new Date(presupuestoSeleccionado.fechaEnvio).toLocaleDateString('es-AR')}</strong>
                                    </div>
                                  </div>
                                )}

                                {/* Campos adicionales según configuración */}
                                {presupuestoSeleccionado.configuracionAdicional && (
                                  <div className="col-12">
                                    <div className="bg-light p-3 rounded">
                                      <small className="text-muted d-block mb-1"><i className="fas fa-cogs me-1"></i>Configuración Adicional</small>
                                      <pre className="mb-0" style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                                        {JSON.stringify(presupuestoSeleccionado.configuracionAdicional, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Importar desde Items Agregados - Bloque Colapsable */}
                  {mostrarBloqueImportarItems && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="border rounded p-3" style={{backgroundColor: '#f5e6d3'}}>
                        <h6
                          className="mb-3"
                          style={{cursor: 'pointer', fontWeight: 'bold', color: '#8b4513'}}
                          onClick={() => setMostrarImportarItems(!mostrarImportarItems)}
                        >
                          <i className="fas fa-file-import me-2"></i>
                          📥 Configuración de Importar desde Items Agregados
                          <span className="ms-2 small">{mostrarImportarItems ? '▼' : '▶'}</span>
                        </h6>

                        {mostrarImportarItems && (
                          <div className="card">
                            <div className="card-body">
                              {presupuestoSeleccionado.itemsAgregados && presupuestoSeleccionado.itemsAgregados.length > 0 ? (
                                <div className="alert alert-info mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  Este presupuesto fue generado importando {presupuestoSeleccionado.itemsAgregados.length} item(s)
                                </div>
                              ) : (
                                <div className="alert alert-secondary mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  No se importaron items para este presupuesto
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Configuración de Presupuesto por Profesionales, Materiales, Otros Costos */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="mt-3 border rounded p-3" style={{backgroundColor: 'rgb(255, 243, 205)'}}>
                        <h6
                          className="mb-3"
                          style={{cursor: 'pointer', fontWeight: 'bold', color: 'rgb(255, 140, 66)'}}
                          onClick={() => setMostrarConfiguracionProfesionales(!mostrarConfiguracionProfesionales)}
                        >
                          <i className="fas fa-list-ul me-2"></i>
                          Configuración de Presupuesto por Profesionales, Materiales, Otros Costos
                          <span className="ms-2 small">{mostrarConfiguracionProfesionales ? '▼' : '▶'}</span>
                        </h6>

                        {mostrarConfiguracionProfesionales && (
                          <>
                            {console.log('🎨 Renderizando bloque de configuración de profesionales')}

                            {/* NUEVA SECCIÓN: Calculadora de Profesional */}
                            <div className="mb-3">
                              <div className="d-flex align-items-center mb-2">
                                <h6 className="mb-0 me-4">
                                  <i className="fas fa-calculator me-2"></i>
                                  Calculadora de Presupuesto
                                </h6>
                              </div>

                              <div className="border rounded p-3 bg-light">
                                <div className="row g-2">
                                  {/* Tipo de Profesional */}
                                  <div className="col-md-12">
                                    <label className="form-label small mb-1">Tipo de Profesional</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={tipoProfesional}
                                      onChange={(e) => setTipoProfesional(e.target.value)}
                                      placeholder="Ej: Albañil, Plomero..."
                                    />
                                  </div>

                                  {/* Cantidad de Jornales */}
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Cantidad de Jornales</label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={cantidadJornales}
                                      onChange={(e) => setCantidadJornales(e.target.value)}
                                      placeholder="0"
                                      min="0"
                                      step="1"
                                    />
                                  </div>

                                  {/* Importe por Jornal */}
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Jornal</label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={importeJornal}
                                      onChange={(e) => setImporteJornal(e.target.value)}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>

                                  {/* Subtotal Mano de Obra */}
                                  <div className="col-md-4">
                                    <label className="form-label small mb-1">Subtotal M.O.</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm bg-info bg-opacity-10"
                                      value={`$${subtotalManoObra.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                      readOnly
                                    />
                                  </div>

                                  {/* Materiales */}
                                  <div className="col-md-6">
                                    <label className="form-label small mb-1">Materiales</label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={importeMateriales}
                                      onChange={(e) => setImporteMateriales(e.target.value)}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>

                                  {/* Total (manual o automático) */}
                                  <div className="col-md-6">
                                    <label className="form-label small mb-1">
                                      Total {(cantidadJornales || importeJornal || importeMateriales) ? '(automático)' : '(manual)'}
                                    </label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={totalManual}
                                      onChange={(e) => setTotalManual(e.target.value)}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                      disabled={cantidadJornales || importeJornal || importeMateriales}
                                    />
                                  </div>
                                </div>

                                {/* Resultado Final */}
                                <div className="alert alert-success py-2 mb-0 mt-2">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <small className="fw-bold">💰 TOTAL FINAL:</small>
                                    <strong className="text-success">
                                      ${(() => {
                                        if (cantidadJornales || importeJornal || importeMateriales) {
                                          return totalCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                        }
                                        return (totalManual ? Number(totalManual) : 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                      })()}
                                    </strong>
                                  </div>
                                  {(cantidadJornales || importeJornal) && importeMateriales && (
                                    <small className="text-muted d-block">
                                      ({cantidadJornales} × ${Number(importeJornal).toLocaleString('es-AR')} + ${Number(importeMateriales).toLocaleString('es-AR')})
                                    </small>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Sección de Profesionales */}
                            <div className="mb-3">
                              <div className="d-flex align-items-center mb-2">
                                <h6 className="mb-0 me-4">Profesionales</h6>
                                <button type="button" className="btn btn-sm btn-outline-primary">
                                  <i className="fas fa-plus me-1"></i>Agregar profesional
                                </button>
                              </div>
                              <div className="alert alert-info py-2 mb-2">
                                <small>
                                  👷 {presupuestoSeleccionado.profesionales?.length || 0} profesionales agregados -
                                  Total gastado: ${(presupuestoSeleccionado.totalProfesionales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} |
                                  Presupuesto: ${(presupuestoSeleccionado.totalProfesionales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </small>
                              </div>
                            </div>

                            {/* Sección de Materiales */}
                            <div className="mb-3">
                              <div className="d-flex align-items-center mb-2">
                                <h6 className="mb-0 me-4">Materiales</h6>
                                <button type="button" className="btn btn-sm btn-outline-primary ms-3">
                                  <i className="fas fa-plus me-1"></i>Agregar material
                                </button>
                              </div>
                              <div className="alert alert-success py-2 mb-2">
                                <small>
                                  🧱 {presupuestoSeleccionado.materialesList?.length || 0} material(es) agregado(s) -
                                  Total gastado: ${(presupuestoSeleccionado.totalMateriales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} |
                                  Presupuesto: ${(presupuestoSeleccionado.totalMateriales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </small>
                              </div>
                            </div>

                            {/* Sección de Otros Costos */}
                            <div className="mb-3">
                              <div className="d-flex align-items-center mb-2">
                                <h6 className="mb-0 me-4">Otros Costos</h6>
                                <button type="button" className="btn btn-sm btn-outline-primary">
                                  <i className="fas fa-plus me-1"></i>Agregar otro costo
                                </button>
                              </div>
                              <div className="alert alert-warning py-2 mb-2">
                                <small>
                                  💼 {presupuestoSeleccionado.otrosCostos?.length || 0} otro(s) costo(s) agregado(s) -
                                  Total gastado: ${(presupuestoSeleccionado.totalOtros || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} |
                                  Presupuesto: ${(presupuestoSeleccionado.totalOtros || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </small>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Configuración de Honorarios - Bloque Colapsable */}
                  {mostrarBloqueHonorarios && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="border rounded p-3" style={{backgroundColor: '#f8d7da'}}>
                        <h6
                          className="mb-3"
                          style={{cursor: 'pointer', fontWeight: 'bold', color: '#d9534f'}}
                          onClick={() => setMostrarHonorarios(!mostrarHonorarios)}
                        >
                          <i className="fas fa-percentage me-2"></i>
                          🧮 Configuración de Honorarios
                          <span className="ms-2 small">{mostrarHonorarios ? '▼' : '▶'}</span>
                        </h6>

                        {mostrarHonorarios && (
                          <div className="card">
                            <div className="card-body">
                              {presupuestoSeleccionado.honorariosDesglosados ? (
                                <div className="row g-3">
                                  {presupuestoSeleccionado.honorariosDesglosados.profesionales > 0 && (
                                    <div className="col-md-4">
                                      <div className="bg-light p-3 rounded text-center">
                                        <small className="text-muted d-block mb-1">👷 Profesionales</small>
                                        <h5 className="mb-0 text-primary">
                                          ${presupuestoSeleccionado.honorariosDesglosados.profesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </h5>
                                      </div>
                                    </div>
                                  )}

                                  {presupuestoSeleccionado.honorariosDesglosados.materiales > 0 && (
                                    <div className="col-md-4">
                                      <div className="bg-light p-3 rounded text-center">
                                        <small className="text-muted d-block mb-1">🧱 Materiales</small>
                                        <h5 className="mb-0 text-success">
                                          ${presupuestoSeleccionado.honorariosDesglosados.materiales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </h5>
                                      </div>
                                    </div>
                                  )}

                                  {presupuestoSeleccionado.honorariosDesglosados.otrosCostos > 0 && (
                                    <div className="col-md-4">
                                      <div className="bg-light p-3 rounded text-center">
                                        <small className="text-muted d-block mb-1">📦 Otros Costos</small>
                                        <h5 className="mb-0 text-warning">
                                          ${presupuestoSeleccionado.honorariosDesglosados.otrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </h5>
                                      </div>
                                    </div>
                                  )}

                                  <div className="col-12">
                                    <div className="bg-primary bg-opacity-10 p-3 rounded text-center">
                                      <small className="text-muted d-block mb-1">💰 Total Honorarios</small>
                                      <h4 className="mb-0 text-primary fw-bold">
                                        ${presupuestoSeleccionado.honorariosDesglosados.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </h4>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="alert alert-secondary mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  No se configuraron honorarios para este presupuesto
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* 🆕 SECCIÓN: Composición del Presupuesto (Grupos de Tareas) - COMPLETA */}
                  {itemsCalculadoraConsolidados && itemsCalculadoraConsolidados.length > 0 && (
                  <div className="row mb-3 seccion-base-presupuesto">
                    <div className="col-12">
                      <div className="card border-success">
                        <div className="card-body">
                          <div className="mb-3">
                            <h6 className="mb-2 text-muted">
                              <i className="fas fa-clipboard-list me-2"></i>
                              Composición del Presupuesto
                            </h6>

                            {/* Grupos de Tareas (Calculadora) */}
                            <div className="mb-3">
                              <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                                <span className="fw-bold text-info">
                                  <i className="fas fa-calculator me-2"></i>
                                  Grupos de Tareas ({itemsCalculadoraConsolidados.length})
                                </span>
                                <span className="fw-bold text-info">
                                  ${itemsCalculadoraConsolidados.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                                          {item.descripcion && item.descripcion !== item.tipoProfesional && (
                                            <span className="text-muted fw-normal"> - {item.descripcion}</span>
                                          )}
                                        </div>
                                        <div className="small text-muted">
                                          {item.jornales && item.jornales.length > 0 && (
                                            <div className="mb-1">
                                              <div className="fw-semibold text-info">
                                                <i className="fas fa-hard-hat me-2"></i>Jornales: ${(item.subtotalJornalesFinal || item.subtotalJornales || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </div>
                                            </div>
                                          )}
                                          {item.profesionales && item.profesionales.length > 0 && (
                                            <div className="mb-1">
                                              <div className="fw-semibold text-primary">
                                                <i className="fas fa-users me-2"></i>Mano de Obra: ${(item.subtotalManoObraFinal || item.subtotalManoObra || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </div>
                                            </div>
                                          )}
                                          {((item.materialesLista && item.materialesLista.length > 0) || (item.materiales && item.materiales.length > 0)) && (
                                            <div className="mb-1">
                                              <div className="fw-semibold text-success">
                                                <i className="fas fa-box me-2"></i>Materiales: ${(item.subtotalMaterialesFinal || item.subtotalMateriales || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </div>
                                            </div>
                                          )}
                                          {item.gastosGenerales && item.gastosGenerales.length > 0 && (
                                            <div className="mb-1">
                                              <div className="fw-semibold text-warning">
                                                <i className="fas fa-receipt me-2"></i>Gastos Generales: ${(item.subtotalGastosGeneralesFinal || item.subtotalGastosGenerales || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="ms-3 text-end">
                                        <span className="fw-bold text-dark">
                                          ${Number(item.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                    {(item.descripcion || item.observaciones ||
                                      item.descripcionJornales || item.observacionesJornales ||
                                      item.descripcionProfesionales || item.observacionesProfesionales ||
                                      item.descripcionMateriales || item.observacionesMateriales ||
                                      item.descripcionGastosGenerales || item.observacionesGastosGenerales ||
                                      item.descripcionTotalManual || item.observacionesTotalManual) && (
                                      <div className="mt-2 pt-2" style={{borderTop: '1px dashed #dee2e6'}}>
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

                            {/* Desglose por categoría */}
                            <div className="mb-3">
                              <h6 className="mb-2 text-muted small">
                                <i className="fas fa-list-ul me-2"></i>
                                Desglose por Categoría
                              </h6>
                              {itemsCalculadoraConsolidados.map((item, idx) => (
                                <div key={idx} className="d-flex justify-content-between align-items-center p-2 bg-light mb-2 rounded">
                                  <span>
                                    <span className="text-secondary">
                                      <i className="fas fa-cube me-2"></i>
                                      {item.tipoProfesional}
                                    </span>
                                  </span>
                                  <span className="fw-bold">
                                    ${Number(item.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Total Final */}
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
                                    ${itemsCalculadoraConsolidados.reduce((sum, item) => sum + (Number(item.total) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </h3>
                                </div>
                                <div className="mt-2">
                                  <small className="text-muted">
                                    Incluye todos los rubros: mano de obra, materiales, jornales, honorarios.
                                  </small>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Base del Presupuesto con Honorarios - SOLO SI NO HAY itemsCalculadoraConsolidados */}
                  {(!itemsCalculadoraConsolidados || itemsCalculadoraConsolidados.length === 0) && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="card border-success">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <h6 className="mb-1"><i className="fas fa-calculator me-2 text-success"></i>Base del Presupuesto</h6>
                              <small className="text-muted">
                                {presupuestoSeleccionado.costosIniciales
                                  ? '📐 Calculado desde configuración de m²'
                                  : 'Suma de profesionales + materiales + otros costos'}
                              </small>
                            </div>
                            <h4 className="mb-0 text-success">
                              ${presupuestoSeleccionado.montoTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}
                            </h4>
                          </div>

                          {/* Desglose de la base */}
                          <div className="mt-2 pt-2 border-top">
                            <div className="d-flex justify-content-between mt-1">
                              <span className="small">Profesionales:</span>
                              <span className="small fw-bold">
                                ${(presupuestoSeleccionado.totalProfesionales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mt-1">
                              <span className="small">Materiales:</span>
                              <span className="small fw-bold">
                                ${(presupuestoSeleccionado.totalMateriales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mt-1">
                              <span className="small">Otros Costos:</span>
                              <span className="small fw-bold">
                                ${(presupuestoSeleccionado.totalOtros || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Mostrar honorarios si están configurados */}
                          {presupuestoSeleccionado.honorariosDesglosados && presupuestoSeleccionado.honorariosDesglosados.total > 0 && (
                            <>
                              <div className="mt-3 pt-2 border-top">
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <h6 className="mb-0 text-primary"><i className="fas fa-percentage me-2"></i>Honorarios</h6>
                                  </div>
                                  <h5 className="mb-0 text-primary">
                                    ${presupuestoSeleccionado.honorariosDesglosados.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </h5>
                                </div>
                                <small className="text-muted">Base + Honorarios</small>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Totales: Gastado vs Presupuestado */}
                  <div className="row g-3 mb-3">
                    {/* Total Gastado - CONDICIONAL */}
                    {mostrarTotalGastado && (
                      <div className={`col-12 ${mostrarTotalGastado ? 'col-lg-4' : 'col-lg-6'}`}>
                        <div className="card bg-primary text-white h-100">
                          <div className="card-body text-center py-3">
                            <h6 className="text-white-50 mb-2">
                              <i className="fas fa-receipt me-2"></i>
                              Total Gastado
                            </h6>
                            <h4 className="mb-0">
                              ${presupuestoSeleccionado.montoTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}
                            </h4>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total Honorarios */}
                    <div className={`col-12 ${mostrarTotalGastado ? 'col-lg-4' : 'col-lg-6'}`}>
                      <div className="card bg-info text-white h-100">
                        <div className="card-body text-center py-3">
                          <h6 className="text-white-50 mb-2">
                            <i className="fas fa-briefcase me-2"></i>
                            Honorarios Dirección
                          </h6>
                          <h4 className="mb-0">
                            ${(() => {
                              const valor = presupuestoSeleccionado.honorariosDesglosados?.total || presupuestoSeleccionado.totalHonorarios || 0;
                              console.log('🎨 RENDER Honorarios Tarjeta:', valor, {
                                desglosado: presupuestoSeleccionado.honorariosDesglosados?.total,
                                totalHonorarios: presupuestoSeleccionado.totalHonorarios
                              });
                              return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}
                          </h4>
                          {/* Desglose de honorarios - CONDICIONAL */}
                          {mostrarHonorarios && presupuestoSeleccionado.honorariosDesglosados && (
                            <div className="mt-2" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                              {presupuestoSeleccionado.honorariosDesglosados.profesionales > 0 && (
                                <div>👷 Prof: ${presupuestoSeleccionado.honorariosDesglosados.profesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                              )}
                              {presupuestoSeleccionado.honorariosDesglosados.materiales > 0 && (
                                <div>🧱 Mat: ${presupuestoSeleccionado.honorariosDesglosados.materiales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                              )}
                              {presupuestoSeleccionado.honorariosDesglosados.otrosCostos > 0 && (
                                <div>💼 Otros: ${presupuestoSeleccionado.honorariosDesglosados.otrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                              )}
                            </div>
                          )}
                          {!presupuestoSeleccionado.honorariosDesglosados && presupuestoSeleccionado.honorarioDireccionPorcentaje > 0 && (
                            <small className="d-block mt-1">
                              ({presupuestoSeleccionado.honorarioDireccionPorcentaje}% del total)
                            </small>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total Presupuestado */}
                    <div className={`col-12 ${mostrarTotalGastado ? 'col-lg-4' : 'col-lg-6'}`}>
                      <div className={`card h-100 ${
                        presupuestoSeleccionado.totalPresupuesto > 0
                          ? (presupuestoSeleccionado.montoTotal <= presupuestoSeleccionado.totalPresupuesto ? 'bg-success' : 'bg-danger')
                          : 'bg-secondary'
                      } text-white`}>
                        <div className="card-body text-center py-3">
                          <h6 className="text-white-50 mb-2">
                            <i className="fas fa-chart-line me-2"></i>
                            Presupuestado
                          </h6>
                          <h4 className="mb-0">
                            ${presupuestoSeleccionado.totalPresupuesto?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}
                          </h4>
                          {presupuestoSeleccionado.totalPresupuesto > 0 && (
                            <small className="d-block mt-1">
                              {presupuestoSeleccionado.montoTotal <= presupuestoSeleccionado.totalPresupuesto ? (
                                <>
                                  <i className="fas fa-check-circle me-1"></i>
                                  Disponible: ${(presupuestoSeleccionado.totalPresupuesto - presupuestoSeleccionado.montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-exclamation-triangle me-1"></i>
                                  Excedido: ${(presupuestoSeleccionado.montoTotal - presupuestoSeleccionado.totalPresupuesto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </>
                              )}
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Final con Honorarios */}
                  {(presupuestoSeleccionado.totalPresupuesto > 0 || presupuestoSeleccionado.totalHonorarios > 0) && (
                    <div className="row">
                      <div className="col-12">
                        <div className="card bg-dark text-white">
                          <div className="card-body text-center py-4">
                            <h5 className="text-white-50 mb-2">TOTAL GENERAL (Presupuesto + Honorarios)</h5>
                            <h2 className="mb-0">
                              <i className="fas fa-dollar-sign me-2"></i>
                              ${presupuestoSeleccionado.totalPresupuestoConHonorarios?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}
                            </h2>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="modal-footer">
                {/* Sección de PDFs guardados */}
                <div className="w-100 mb-3">
                  <div className="card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="fas fa-file-pdf me-2 text-danger"></i>
                        PDFs Guardados ({archivosPDF.length})
                      </h6>
                    </div>
                    <div className="card-body" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {cargandoPDFs ? (
                        <div className="text-center py-3">
                          <i className="fas fa-spinner fa-spin me-2"></i>
                          Cargando PDFs...
                        </div>
                      ) : archivosPDF.length === 0 ? (
                        <div className="text-center text-muted py-3">
                          <i className="fas fa-inbox me-2"></i>
                          <div>No se han generado PDFs para este presupuesto</div>
                          <small className="text-muted d-block mt-2">
                            Usa el botón "Subir Nuevo PDF" para agregar un archivo
                          </small>
                        </div>
                      ) : (
                        <div className="list-group list-group-flush">
                          {archivosPDF.map((pdf) => (
                            <div key={pdf.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div className="flex-grow-1">
                                <div className="d-flex align-items-center">
                                  <i className="fas fa-file-pdf text-danger me-2"></i>
                                  <div>
                                    <button
                                      className="fw-bold btn btn-link p-0 text-decoration-none"
                                      style={{ color: '#d32f2f', cursor: 'pointer' }}
                                      onClick={() => descargarPDF(pdf.id, pdf.nombreArchivo || pdf.nombre_archivo)}
                                      title="Descargar PDF"
                                    >
                                      {pdf.nombreArchivo || pdf.nombre_archivo}
                                    </button>
                                    <small className="text-muted">
                                      {formatearTamanio(pdf.tamanioBytes || pdf.tamanio_bytes)} • {' '}
                                      {new Date(pdf.fechaGeneracion || pdf.fecha_generacion).toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                      {pdf.versionPresupuesto && ` • v${pdf.versionPresupuesto}`}
                                    </small>
                                    <div>
                                      {(pdf.incluyeHonorarios || pdf.incluye_honorarios) && (
                                        <span className="badge bg-info me-1">Con Honorarios</span>
                                      )}
                                      {(pdf.incluyeConfiguracion || pdf.incluye_configuracion) && (
                                        <span className="badge bg-success me-1">Con Configuración</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="btn-group btn-group-sm ms-2">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => descargarPDF(pdf.id, pdf.nombreArchivo || pdf.nombre_archivo)}
                                  title="Descargar PDF"
                                >
                                  <i className="fas fa-download"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => eliminarPDF(pdf.id)}
                                  title="Eliminar PDF"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón para subir nuevo PDF */}
                      <div className="mt-3 text-center">
                        <input
                          type="file"
                          id="pdfFileInput"
                          accept="application/pdf"
                          style={{ display: 'none' }}
                          onChange={handleFileSelect}
                          disabled={subiendoPDF}
                        />
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => document.getElementById('pdfFileInput').click()}
                          disabled={subiendoPDF}
                        >
                          {subiendoPDF ? (
                            <>
                              <i className="fas fa-spinner fa-spin me-2"></i>
                              Subiendo PDF...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-upload me-2"></i>
                              Subir Nuevo PDF
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-column flex-md-row gap-2 w-100">
                  {/* Botón 1: Volver a la lista */}
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={volverALista}
                    disabled={enviando}
                  >
                    <i className="fas fa-arrow-left me-2"></i>
                    Volver a la Lista
                  </button>

                  <div className="flex-fill"></div>

                  {/* Botón 2: Enviar por WhatsApp */}
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => {
                      console.log('🟢 CLIC EN BOTÓN WHATSAPP - EnviarPresupuestoModal');
                      console.log('  - presupuestoSeleccionado:', presupuestoSeleccionado?.id);
                      console.log('  - onAbrirPresupuestoParaPDF existe:', !!onAbrirPresupuestoParaPDF);

                      if (onAbrirPresupuestoParaPDF && presupuestoSeleccionado) {
                        console.log('✅ Llamando a onAbrirPresupuestoParaPDF...');
                        onAbrirPresupuestoParaPDF(presupuestoSeleccionado);
                      } else {
                        console.error('❌ No se puede abrir:', {
                          tieneCallback: !!onAbrirPresupuestoParaPDF,
                          tienePresupuesto: !!presupuestoSeleccionado
                        });
                        alert('Funcion no disponible');
                      }
                    }}
                    disabled={enviando}
                    title="Abrir presupuesto completo y generar PDF para WhatsApp"
                  >
                    {enviando ? (
                      <>
                        <i className="fas fa-spinner fa-spin me-2"></i>
                        Preparando...
                      </>
                    ) : (
                      <>
                        <i className="fab fa-whatsapp me-2"></i>
                        WhatsApp {archivosPDF.length > 0 && `(${archivosPDF.length})`}
                      </>
                    )}
                  </button>

                  {/* Botón 3: Enviar por Email */}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (onAbrirPresupuestoParaEmail && presupuestoSeleccionado) {
                        onAbrirPresupuestoParaEmail(presupuestoSeleccionado);
                      } else {
                        alert('Funcion no disponible');
                      }
                    }}
                    disabled={enviando}
                    title="Abrir presupuesto completo y generar PDF para Email"
                  >
                    {enviando ? (
                      <>
                        <i className="fas fa-spinner fa-spin me-2"></i>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-envelope me-2"></i>
                        Email
                      </>
                    )}
                  </button>

                  {/* Botón 4: Cancelar */}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={cerrarTodo}
                    disabled={enviando}
                  >
                    <i className="fas fa-times me-2"></i>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EnviarPresupuestoModal;
