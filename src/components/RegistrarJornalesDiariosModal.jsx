import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Table, Spinner, Alert, Badge } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import * as jornalesService from '../services/jornalesDiariosService';
import { obtenerRubrosActivosPorObra } from '../services/jornalesDiariosService';
import { listarAsignaciones } from '../services/profesionalesObraService';
import api from '../services/api';
import RubroSelector from './RubroSelector';
import axios from 'axios';

/**
 * Modal para registrar jornales diarios de profesionales en una obra
 * Muestra los profesionales asignados y permite ingresar horas trabajadas
 */
const RegistrarJornalesDiariosModal = ({ show, onHide, obra, onJornalCreado, onAbrirAsignarProfesionales }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [profesionalesAsignados, setProfesionalesAsignados] = useState([]);
  const [jornalesDelDia, setJornalesDelDia] = useState({});
  const [jornalesExistentes, setJornalesExistentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Nuevos estados para selector de profesionales
  const [vistaSeleccion, setVistaSeleccion] = useState(true); // 🆕 Cambiado a true para siempre mostrar la vista con calendarios
  const [todosProfesionales, setTodosProfesionales] = useState([]);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [asignacionesPorProfesional, setAsignacionesPorProfesional] = useState({});

  // Estado para rubros del presupuesto de la obra
  const [rubros, setRubros] = useState([]);

  // NUEVO: Estados para multi-fecha
  const [fechasPorProfesional, setFechasPorProfesional] = useState({}); // { profesionalId: [{ fecha, fraccion }] }
  const [profesionalEditandoFechas, setProfesionalEditandoFechas] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [ultimaFechaAgregada, setUltimaFechaAgregada] = useState(''); // Para recordar última fecha agregada

  // 🆕 Estados para selección de rango de fechas
  const [modoSeleccion, setModoSeleccion] = useState('unica'); // 'unica' o 'rango'
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [incluirFinesSemana, setIncluirFinesSemana] = useState(true);

  // 🆕 Estado para fechas pendientes (acumulación antes de confirmar)
  const [fechasPendientes, setFechasPendientes] = useState([]); // Array de strings YYYY-MM-DD

  // 🆕 Estados para pestañas y agregar profesional manualmente
  const [tabSeleccion, setTabSeleccion] = useState('lista'); // 'lista' o 'manual'
  const [profesionalManual, setProfesionalManual] = useState({
    nombre: '',
    tipoProfesional: '',
    honorario: '',
    telefono: '',
    email: ''
  });
  const [profesionalesTemporales, setProfesionalesTemporales] = useState([]);
  const [guardarEnCatalogo, setGuardarEnCatalogo] = useState(false); // Para controlar si se guarda permanentemente

  // 🆕 Estado para mostrar/ocultar tarifas diarias
  const [mostrarTarifas, setMostrarTarifas] = useState(false); // Por defecto NO muestra tarifas

  // 🇦🇷 Feriados de Argentina 2026
  const feriadosArgentina2026 = [
    '2026-01-01', // Año Nuevo
    '2026-02-16', // Carnaval
    '2026-02-17', // Carnaval
    '2026-03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
    '2026-04-02', // Día del Veterano y de los Caídos en la Guerra de Malvinas
    '2026-04-03', // Viernes Santo
    '2026-05-01', // Día del Trabajador
    '2026-05-25', // Día de la Revolución de Mayo
    '2026-06-15', // Paso a la Inmortalidad del Gral. Martín Miguel de Güemes
    '2026-06-20', // Paso a la Inmortalidad del Gral. Manuel Belgrano
    '2026-07-09', // Día de la Independencia
    '2026-08-17', // Paso a la Inmortalidad del Gral. José de San Martín (puente)
    '2026-10-12', // Día del Respeto a la Diversidad Cultural
    '2026-11-23', // Día de la Soberanía Nacional (puente)
    '2026-12-08', // Día de la Inmaculada Concepción de María
    '2026-12-25', // Navidad
  ];

  // Función para detectar si una fecha es feriado
  const esFeriado = (fechaStr) => {
    if (!fechaStr) return false;
    return feriadosArgentina2026.includes(fechaStr);
  };

  // Cargar profesionales asignados a la obra
  useEffect(() => {
    if (show && obra && empresaSeleccionada) {
      cargarProfesionalesAsignados();
      cargarRubros();
      cargarTodosProfesionales(); // 🆕 Cargar todos los profesionales para la vista de selección
    }
  }, [show, obra, empresaSeleccionada]);

  // Cargar jornales existentes cuando cambia la fecha
  useEffect(() => {
    if (show && obra && empresaSeleccionada && fecha) {
      cargarJornalesExistentes();
    }
  }, [fecha, show, obra, empresaSeleccionada]);

  const cargarProfesionalesAsignados = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listarAsignaciones(empresaSeleccionada.id);
      const asignaciones = Array.isArray(response) ? response : (response?.data || []);

      // Filtrar solo los de esta obra
      const asignacionesObra = asignaciones.filter(a => a.obraId === obra.id && a.activo);

      setProfesionalesAsignados(asignacionesObra);
      console.log(`✅ ${asignacionesObra.length} profesionales asignados a la obra`);
    } catch (err) {
      console.error('❌ Error al cargar profesionales:', err);
      setError('No se pudieron cargar los profesionales asignados');
    } finally {
      setLoading(false);
    }
  };

  const cargarRubros = async () => {
    if (!obra?.id) return;
    try {
      // Cargar SOLO los rubros del presupuesto vinculado a esta obra
      const lista = await obtenerRubrosActivosPorObra(obra.id, empresaSeleccionada.id);
      setRubros(lista);
      console.log(`✅ ${lista.length} rubros cargados del presupuesto de la obra ${obra.id}`);
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar los rubros:', err);
      setRubros([]);
    }
  };

  const cargarJornalesExistentes = async () => {    try {
      const fechaDesde = fecha;
      const fechaHasta = fecha;
      const response = await jornalesService.listarJornalesPorFechas(fechaDesde, fechaHasta, empresaSeleccionada.id);
      const jornales = Array.isArray(response) ? response : (response?.data || []);

      // Filtrar solo los de esta obra
      const jornalesObra = jornales.filter(j => j.obraId === obra.id);
      setJornalesExistentes(jornalesObra);

      // Pre-llenar el formulario con los jornales existentes
      const jornalesMap = {};
      jornalesObra.forEach(j => {
        jornalesMap[j.profesionalId] = {
          horasTrabajadasDecimal: j.horasTrabajadasDecimal,
          observaciones: j.observaciones || '',
          rubroId: j.rubroId || null,
          rubroNombre: j.rubroNombre || '',
          id: j.id
        };
      });
      setJornalesDelDia(jornalesMap);

      if (jornalesObra.length > 0) {
        console.log(`📋 ${jornalesObra.length} jornales ya registrados para ${fecha}`);
      }
    } catch (err) {
      console.error('❌ Error al cargar jornales existentes:', err);
    }
  };

  const cargarTodosProfesionales = async () => {
    console.log('🔥 cargarTodosProfesionales() - INICIANDO con empresaId:', empresaSeleccionada?.id);
    setLoading(true);
    try {
      // Cargar profesionales
      const response = await api.profesionales.getAll(empresaSeleccionada.id);
      const profesionales = Array.isArray(response) ? response : (response?.data || []);
      setTodosProfesionales(profesionales);
      console.log(`✅ ${profesionales.length} profesionales disponibles en la empresa`);

      // Cargar todas las asignaciones de profesionales a obras
      try {
        const asignacionesResponse = await listarAsignaciones(empresaSeleccionada.id);
        const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : (asignacionesResponse?.data || []);

        // Crear un mapa: profesionalId -> [obras con fechas]
        const mapaAsignaciones = {};
        asignaciones.forEach(asig => {
          if (asig.activo && asig.profesionalId) {
            if (!mapaAsignaciones[asig.profesionalId]) {
              mapaAsignaciones[asig.profesionalId] = [];
            }

            // Agregar cada asignación con sus fechas (puede haber múltiples asignaciones a la misma obra en diferentes períodos)
            mapaAsignaciones[asig.profesionalId].push({
              obraId: asig.obraId,
              obraNombre: asig.obraNombre || `Obra ${asig.obraId}`,
              fechaInicio: asig.fechaInicio,
              fechaFin: asig.fechaFin,
              semana: asig.semana,
              anio: asig.anio,
              asignacionId: asig.id
            });
          }
        });

        setAsignacionesPorProfesional(mapaAsignaciones);
        console.log(`✅ Asignaciones de profesionales cargadas:`, mapaAsignaciones);
      } catch (errAsig) {
        console.warn('⚠️ No se pudieron cargar las asignaciones:', errAsig);
        setAsignacionesPorProfesional({});
      }
    } catch (err) {
      console.error('❌ Error al cargar profesionales:', err);
      setError('No se pudieron cargar los profesionales disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirSelectorProfesionales = () => {
    setVistaSeleccion(true);
    cargarTodosProfesionales();
  };

  const handleVolverAFormulario = () => {
    // 🆕 Ya no volvemos a la vista antigua, simplemente limpiamos selección
    // setVistaSeleccion(false); // ❌ ELIMINADO - siempre mantenemos la vista con calendarios
    setProfesionalesSeleccionados([]);
    setFechasPorProfesional({}); // Limpiar fechas también
    // Recargar profesionales asignados y jornales
    cargarProfesionalesAsignados();
    cargarJornalesExistentes();
  };

  const handleSeleccionarProfesional = (profesional) => {
    if (profesionalesSeleccionados.find(p => p.id === profesional.id)) {
      // Deseleccionar
      setProfesionalesSeleccionados(prev => prev.filter(p => p.id !== profesional.id));
      // NUEVO: Limpiar fechas del profesional
      setFechasPorProfesional(prev => {
        const nuevo = { ...prev };
        delete nuevo[profesional.id];
        return nuevo;
      });
    } else {
      // Seleccionar con fracción por defecto 1.0 y tarifa
      setProfesionalesSeleccionados(prev => [...prev, {
        ...profesional,
        horasTrabajadasDecimal: 1.0,
        observaciones: '',
        tarifaDiaria: profesional.honorario || 0 // Usar honorario si existe, sino 0
      }]);
      // NUEVO: Inicializar sin fechas (el usuario debe agregarlas manualmente)
      setFechasPorProfesional(prev => ({
        ...prev,
        [profesional.id]: []
      }));
    }
  };

  const handleCambiarFraccionSeleccionado = (profesionalId, fraccion) => {
    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? { ...p, horasTrabajadasDecimal: parseFloat(fraccion) } : p)
    );
  };

  const handleCambiarTarifaSeleccionado = (profesionalId, tarifa) => {
    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? { ...p, tarifaDiaria: parseFloat(tarifa) || 0 } : p)
    );
  };

  const handleCambiarRubroSeleccionado = (profesionalId, nombreRubro) => {
    // Buscar el ID del rubro seleccionado por su nombre
    const rubroEncontrado = rubros.find(r => r.nombreRubro === nombreRubro);
    const rubroId = rubroEncontrado ? rubroEncontrado.id : null;

    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? {
        ...p,
        rubroId: rubroId,
        rubroNombre: nombreRubro
      } : p)
    );

    // Si el rubro no existe aún (nuevo), se creará automáticamente en el backend
    if (!rubroEncontrado && nombreRubro) {
      console.log(`ℹ️ Rubro "${nombreRubro}" no existe aún - se creará automáticamente al guardar`);
    }
  };

  // NUEVO: Handlers para multi-fecha
  const handleAbrirSelectorFechas = (profesionalId) => {
    setProfesionalEditandoFechas(profesionalId);
    setNuevaFecha(''); // No pre-cargar ninguna fecha, el usuario debe seleccionarla
    setModoSeleccion('unica'); // Resetear a modo único al cambiar de profesional
    setFechaInicio('');
    setFechaFin('');
    setFechasPendientes([]); // Limpiar fechas pendientes
  };

  // 🆕 Agregar fecha a la lista pendiente (modo único con acumulación)
  const handleAgregarFechaPendiente = () => {
    if (!nuevaFecha) {
      setError('Debes seleccionar una fecha');
      return;
    }

    // Verificar si ya está en pendientes
    if (fechasPendientes.includes(nuevaFecha)) {
      setError('Esta fecha ya está en la lista pendiente');
      return;
    }

    // Verificar si ya está agregada al profesional
    const fechasActuales = fechasPorProfesional[profesionalEditandoFechas] || [];
    if (fechasActuales.some(f => f.fecha === nuevaFecha)) {
      setError('Esta fecha ya está agregada al profesional');
      return;
    }

    // Agregar a pendientes
    setFechasPendientes(prev => [...prev, nuevaFecha]);
    setUltimaFechaAgregada(nuevaFecha);
    setNuevaFecha(''); // Limpiar input para siguiente selección
  };

  // 🆕 Confirmar todas las fechas pendientes
  const handleConfirmarFechasPendientes = () => {
    if (fechasPendientes.length === 0) {
      setError('No hay fechas pendientes para confirmar');
      return;
    }

    if (!profesionalEditandoFechas) {
      setError('Error: no hay profesional seleccionado');
      return;
    }

    setFechasPorProfesional(prev => {
      const fechasActuales = prev[profesionalEditandoFechas] || [];
      const nuevasFechas = fechasPendientes.map(fecha => ({ fecha, fraccion: 1.0 }));

      return {
        ...prev,
        [profesionalEditandoFechas]: [...fechasActuales, ...nuevasFechas]
      };
    });

    const cantidadFeriados = fechasPendientes.filter(f => esFeriado(f)).length;
    setSuccess(`✅ ${fechasPendientes.length} fecha${fechasPendientes.length > 1 ? 's' : ''} confirmada${fechasPendientes.length > 1 ? 's' : ''}${cantidadFeriados > 0 ? ` (incluye ${cantidadFeriados} feriado${cantidadFeriados > 1 ? 's' : ''})` : ''}`);
    setTimeout(() => setSuccess(null), 4000);

    // Limpiar pendientes
    setFechasPendientes([]);
  };

  // 🆕 Limpiar fechas pendientes
  const handleLimpiarFechasPendientes = () => {
    setFechasPendientes([]);
  };

  // 🆕 Eliminar una fecha específica de pendientes
  const handleEliminarFechaPendiente = (fechaAEliminar) => {
    setFechasPendientes(prev => prev.filter(f => f !== fechaAEliminar));
  };

  const handleAgregarFecha = () => {
    if (!nuevaFecha || !profesionalEditandoFechas) return;

    setFechasPorProfesional(prev => {
      const fechasActuales = prev[profesionalEditandoFechas] || [];

      // Verificar si la fecha ya existe
      if (fechasActuales.some(f => f.fecha === nuevaFecha)) {
        alert('Esta fecha ya está seleccionada para este profesional');
        return prev;
      }

      return {
        ...prev,
        [profesionalEditandoFechas]: [...fechasActuales, { fecha: nuevaFecha, fraccion: 1.0 }]
      };
    });

    // 🆕 Guardar como última fecha agregada para reutilizar
    setUltimaFechaAgregada(nuevaFecha);
    setNuevaFecha('');
  };

  // 🆕 Agregar rango de fechas a pendientes
  const handleAgregarRangoFechas = () => {
    if (!fechaInicio || !fechaFin || !profesionalEditandoFechas) {
      setError('Debes seleccionar fecha de inicio y fin');
      return;
    }

    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');

    if (inicio > fin) {
      setError('La fecha de inicio debe ser anterior o igual a la fecha de fin');
      return;
    }

    // Generar todas las fechas del rango
    const fechasARango = [];
    const fechaActual = new Date(inicio);

    while (fechaActual <= fin) {
      const diaSemana = fechaActual.getDay(); // 0 = domingo, 6 = sábado
      const esFindeSemana = diaSemana === 0 || diaSemana === 6;

      // Solo agregar si incluye fines de semana, o si no es fin de semana
      if (incluirFinesSemana || !esFindeSemana) {
        // Formato YYYY-MM-DD
        const fechaStr = fechaActual.toISOString().split('T')[0];
        fechasARango.push(fechaStr);
      }

      // Avanzar al siguiente día
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    if (fechasARango.length === 0) {
      setError('No hay fechas válidas en el rango seleccionado (probablemente todos son fines de semana)');
      return;
    }

    // Verificar duplicados con fechas ya agregadas y pendientes
    const fechasActuales = fechasPorProfesional[profesionalEditandoFechas] || [];
    const fechasExistentes = new Set(fechasActuales.map(f => f.fecha));
    const fechasPendientesSet = new Set(fechasPendientes);

    // Filtrar fechas ya existentes y pendientes
    const fechasNuevas = fechasARango
      .filter(fecha => !fechasExistentes.has(fecha) && !fechasPendientesSet.has(fecha));

    if (fechasNuevas.length === 0) {
      setError('Todas las fechas del rango ya están agregadas o pendientes');
      return;
    }

    // Agregar a pendientes
    setFechasPendientes(prev => [...prev, ...fechasNuevas]);

    const cantidadFeriadosEnRango = fechasNuevas.filter(f => esFeriado(f)).length;

    setSuccess(`✅ ${fechasNuevas.length} fecha${fechasNuevas.length > 1 ? 's' : ''} agregada${fechasNuevas.length > 1 ? 's' : ''} a la lista${cantidadFeriadosEnRango > 0 ? ` (incluye ${cantidadFeriadosEnRango} feriado${cantidadFeriadosEnRango > 1 ? 's' : ''})` : ''}`);
    setTimeout(() => setSuccess(null), 4000);

    // Limpiar inputs
    setFechaInicio('');
    setFechaFin('');
  };

  // Agregar rango directamente (sin pasar por lista pendiente)
  const handleAgregarRangoFechasDirecto = () => {
    if (!fechaInicio || !fechaFin) {
      setError('Debes seleccionar fecha de inicio y fin');
      return;
    }

    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');

    if (inicio > fin) {
      setError('La fecha de inicio debe ser anterior o igual a la fecha de fin');
      return;
    }

    // Generar todas las fechas del rango
    const fechasARango = [];
    const fechaActual = new Date(inicio);

    while (fechaActual <= fin) {
      const diaSemana = fechaActual.getDay();
      const esFindeSemana = diaSemana === 0 || diaSemana === 6;

      if (incluirFinesSemana || !esFindeSemana) {
        const fechaStr = fechaActual.toISOString().split('T')[0];
        fechasARango.push(fechaStr);
      }

      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    if (fechasARango.length === 0) {
      setError('No hay fechas válidas en el rango seleccionado');
      return;
    }

    // Verificar duplicados solo con fechas ya agregadas
    const fechasActuales = fechasPorProfesional[profesionalEditandoFechas] || [];
    const fechasExistentes = new Set(fechasActuales.map(f => f.fecha));

    const fechasNuevas = fechasARango.filter(fecha => !fechasExistentes.has(fecha));

    if (fechasNuevas.length === 0) {
      setError('Todas las fechas del rango ya están agregadas');
      return;
    }

    // Agregar directamente con fracción 1 (día completo)
    const nuevasFechasConFraccion = fechasNuevas.map(fecha => ({ fecha, fraccion: 1 }));

    setFechasPorProfesional(prev => ({
      ...prev,
      [profesionalEditandoFechas]: [...(prev[profesionalEditandoFechas] || []), ...nuevasFechasConFraccion]
    }));

    const cantidadFeriadosEnRango = fechasNuevas.filter(f => esFeriado(f)).length;

    setSuccess(`✅ ${fechasNuevas.length} fecha${fechasNuevas.length > 1 ? 's' : ''} agregada${fechasNuevas.length > 1 ? 's' : ''} directamente${cantidadFeriadosEnRango > 0 ? ` (incluye ${cantidadFeriadosEnRango} feriado${cantidadFeriadosEnRango > 1 ? 's' : ''})` : ''}`);
    setTimeout(() => setSuccess(null), 4000);

    // Limpiar inputs
    setFechaInicio('');
    setFechaFin('');
  };

  const handleEliminarFecha = (profesionalId, fechaAEliminar) => {
    setFechasPorProfesional(prev => ({
      ...prev,
      [profesionalId]: (prev[profesionalId] || []).filter(f => f.fecha !== fechaAEliminar)
    }));
  };

  const handleCambiarFraccionFecha = (profesionalId, fecha, nuevaFraccion) => {
    setFechasPorProfesional(prev => ({
      ...prev,
      [profesionalId]: (prev[profesionalId] || []).map(f =>
        f.fecha === fecha ? { ...f, fraccion: parseFloat(nuevaFraccion) } : f
      )
    }));
  };

  const handleGuardarProfesionalesSeleccionados = async () => {
    if (profesionalesSeleccionados.length === 0) {
      setError('Debes seleccionar al menos un profesional');
      return;
    }

    // Validar que todos los profesionales tengan rubro seleccionado
    const profesionalesSinRubro = profesionalesSeleccionados.filter(p => !p.rubroNombre || p.rubroNombre.trim() === '');
    if (profesionalesSinRubro.length > 0) {
      const nombres = profesionalesSinRubro.map(p => p.nombre).join(', ');
      setError(`Debes seleccionar un rubro para: ${nombres}`);
      return;
    }

    // NUEVO: Validar que todos los profesionales seleccionados tengan al menos una fecha
    const profesionalesSinFechas = profesionalesSeleccionados.filter(p => !fechasPorProfesional[p.id] || fechasPorProfesional[p.id].length === 0);
    if (profesionalesSinFechas.length > 0) {
      const nombres = profesionalesSinFechas.map(p => p.nombre).join(', ');
      setError(`Debes agregar al menos una fecha para: ${nombres}`);
      return;
    }

    setGuardando(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔍 Guardando jornales - Datos de entrada:', {
        profesionalesSeleccionados,
        fechasPorProfesional,
        obra,
        empresaSeleccionada,
        jornalesExistentes
      });

      // ✨ NUEVO: Crear rubros que no existan antes de guardar jornales
      for (const prof of profesionalesSeleccionados) {
        if (prof.rubroNombre && !prof.rubroId) {
          try {
            console.log(`🆕 Creando rubro nuevo: "${prof.rubroNombre}"`);
            const response = await axios.post('/api/rubros', {
              nombre: prof.rubroNombre,
              categoria: 'personalizado',
              activo: true
            });

            const nuevoRubroId = response.data.id;
            console.log(`✅ Rubro "${prof.rubroNombre}" creado con ID: ${nuevoRubroId}`);

            // Actualizar el profesional con el nuevo ID
            prof.rubroId = nuevoRubroId;

            // Actualizar también el estado de rubros
            setRubros(prev => [...prev, {
              id: nuevoRubroId,
              nombreRubro: prof.rubroNombre,
              activo: true
            }]);
          } catch (err) {
            console.error(`❌ Error al crear rubro "${prof.rubroNombre}":`, err);
            setError(`No se pudo crear el rubro "${prof.rubroNombre}". ${err.response?.data?.message || err.message}`);
            setGuardando(false);
            return;
          }
        }
      }

      // NUEVO: Crear jornales para cada combinación profesional-fecha
      const jornalesAGuardar = [];
      profesionalesSeleccionados.forEach(prof => {
        const fechasProf = fechasPorProfesional[prof.id] || [];
        fechasProf.forEach(({ fecha: fechaJornal, fraccion }) => {
          const jornal = {
            profesionalId: prof.id,
            obraId: obra.id,
            rubroId: prof.rubroId || null,
            fecha: fechaJornal,
            horasTrabajadasDecimal: fraccion,
            observaciones: prof.observaciones || null
          };

          // 🆕 Agregar tarifa SOLO si el switch de mostrarTarifas está activado
          const tarifaAUsar = mostrarTarifas ? (prof.tarifaDiaria || 0) : 0;
          if (tarifaAUsar > 0) {
            jornal.tarifaDiaria = tarifaAUsar;
          }

          jornalesAGuardar.push(jornal);
        });
      });

      console.log('📋 Jornales a guardar (total: ' + jornalesAGuardar.length + '):', jornalesAGuardar);

      let creados = 0;
      let actualizados = 0;
      let errores = 0;

      for (const jornal of jornalesAGuardar) {
        try {
          console.log(`🔍 Procesando jornal para profesional ${jornal.profesionalId} en fecha ${jornal.fecha}:`, jornal);
          console.log(`🔍 ¿Tiene tarifaDiaria?:`, jornal.tarifaDiaria);
          console.log(`🔍 rubroId:`, jornal.rubroId, '(tipo:', typeof jornal.rubroId, ')');
          console.log(`🔍 obraId:`, jornal.obraId, '(tipo:', typeof jornal.obraId, ')');
          console.log(`🔍 profesionalId:`, jornal.profesionalId, '(tipo:', typeof jornal.profesionalId, ')');
          console.log(`🔍 empresaId:`, empresaSeleccionada.id);

          // ⚠️ VALIDACIÓN: Si rubroId es null, mostrar error
          if (!jornal.rubroId) {
            console.error(`❌ FALTA RUBRO para profesional ${jornal.profesionalId}`);
            errores++;
            setError(`El profesional no tiene rubro asignado. Selecciona un rubro antes de guardar.`);
            continue;
          }

          // Verificar si ya existe un jornal para este profesional en esta fecha
          const jornalExistente = jornalesExistentes.find(
            j => j.profesionalId === jornal.profesionalId && j.fecha === jornal.fecha && j.obraId === jornal.obraId
          );

          if (jornalExistente) {
            console.log(`🔄 Actualizando jornal existente (ID: ${jornalExistente.id}) para profesional ${jornal.profesionalId}`);
            await jornalesService.actualizarJornalDiario(jornalExistente.id, jornal, empresaSeleccionada.id);
            actualizados++;
          } else {
            console.log(`➕ Creando nuevo jornal para profesional ${jornal.profesionalId}`);
            await jornalesService.crearJornalDiario(jornal, empresaSeleccionada.id);
            creados++;
          }
        } catch (err) {
          console.error(`❌ Error al guardar jornal para profesional ${jornal.profesionalId}:`, err);
          errores++;
        }
      }

      if (errores === 0) {
        setSuccess(`✅ Jornales guardados: ${creados} nuevos, ${actualizados} actualizados`);

        // Notificar al componente padre
        if (onJornalCreado) onJornalCreado();

        // Cerrar el modal después de 1.5 segundos
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(`⚠️ Se guardaron algunos jornales (${creados} nuevos, ${actualizados} actualizados) pero ${errores} tuvieron errores`);
      }
    } catch (err) {
      console.error('❌ Error al guardar jornales:', err);
      setError(err.message || err.response?.data?.message || 'Error al guardar los jornales');
    } finally {
      setGuardando(false);
    }
  };

  // 🆕 ELIMINADOS: handleHorasChange, handleObservacionesChange, handleRubroChange, handleGuardar
  // (Eran de la vista antigua que fue eliminada)

  const handleClose = () => {
    // 🆕 Limpiar todos los estados
    setJornalesExistentes([]);
    setError(null);
    setSuccess(null);
    setProfesionalesSeleccionados([]);
    setRubros([]);
    // NUEVO: Limpiar estados de multi-fecha
    setFechasPorProfesional({});
    setProfesionalEditandoFechas(null);
    setNuevaFecha('');
    setFechasPendientes([]);
    setProfesionalManual({ nombre: '', tipoProfesional: '', honorario: '', telefono: '', email: '' });
    setProfesionalesTemporales([]);
    setGuardarEnCatalogo(false);
    onHide();
  };

  // 🆕 Funciones para agregar profesional manualmente
  const handleCambiarProfesionalManual = (campo, valor) => {
    setProfesionalManual(prev => ({ ...prev, [campo]: valor }));
  };

  const handleAgregarProfesionalManual = async () => {
    // Validaciones
    if (!profesionalManual.nombre.trim()) {
      setError('El nombre del profesional es obligatorio');
      return;
    }
    if (!profesionalManual.tipoProfesional.trim()) {
      setError('El tipo de profesional es obligatorio');
      return;
    }

    try {
      let nuevoProfesional;

      if (guardarEnCatalogo) {
        // 🆕 GUARDAR EN CATÁLOGO PERMANENTE (BD)
        setGuardando(true);
        setError(null);

        const profesionalDTO = {
          nombre: profesionalManual.nombre.trim(),
          tipoProfesional: profesionalManual.tipoProfesional.trim(),
          honorarioDia: parseFloat(profesionalManual.honorario) || 0,
          telefono: profesionalManual.telefono?.trim() || null,
          email: profesionalManual.email?.trim() || null,
          empresaId: empresaSeleccionada.id,
          activo: true,
          categoria: 'INDEPENDIENTE'
        };

        console.log('📤 Creando profesional permanente:', profesionalDTO);

        const response = await api.post('/api/profesionales', profesionalDTO, {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        });

        console.log('📥 Respuesta completa del backend:', response);
        console.log('📥 response.data:', response.data);

        // Manejar diferentes formatos de respuesta
        const profesionalData = response.data || response;

        if (!profesionalData) {
          throw new Error('El backend no devolvió datos del profesional creado');
        }

        nuevoProfesional = {
          id: profesionalData.id,
          nombre: profesionalData.nombre,
          tipoProfesional: profesionalData.tipoProfesional,
          honorario: profesionalData.honorarioDia || profesionalData.honorario || 0,
          telefono: profesionalData.telefono,
          email: profesionalData.email,
          temporal: false // 🔥 NO es temporal, está en la BD
        };

        console.log('✅ Profesional creado en BD:', nuevoProfesional);
        setSuccess(`✅ Profesional "${nuevoProfesional.nombre}" guardado permanentemente en el catálogo`);
      } else {
        // 📋 AGREGAR SOLO COMO TEMPORAL (sin guardar en BD)
        nuevoProfesional = {
          id: `temp-${Date.now()}`,
          nombre: profesionalManual.nombre,
          tipoProfesional: profesionalManual.tipoProfesional,
          honorario: parseFloat(profesionalManual.honorario) || 0,
          telefono: profesionalManual.telefono || null,
          email: profesionalManual.email || null,
          temporal: true
        };

        setProfesionalesTemporales(prev => [...prev, nuevoProfesional]);
        setSuccess(`Profesional "${nuevoProfesional.nombre}" agregado temporalmente (no se guardó en catálogo)`);
      }

      // Agregar a la lista de profesionales disponibles
      setTodosProfesionales(prev => [...prev, nuevoProfesional]);

      // Limpiar formulario
      setProfesionalManual({
        nombre: '',
        tipoProfesional: '',
        honorario: '',
        telefono: '',
        email: ''
      });
      setGuardarEnCatalogo(false); // Reset checkbox

      setTimeout(() => setSuccess(null), 4000);
    } catch (error) {
      console.error('❌ Error al agregar profesional:', error);
      setError(error.response?.data?.message || 'Error al guardar el profesional en el catálogo');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarProfesionalTemporal = (id) => {
    setProfesionalesTemporales(prev => prev.filter(p => p.id !== id));
    setTodosProfesionales(prev => prev.filter(p => p.id !== id));
    setProfesionalesSeleccionados(prev => prev.filter(p => p.id !== id));
  };

  const calcularMontoCobrado = (profesional, horas) => {
    if (!horas || !profesional) return 0;
    const tarifa = profesional.honorario || profesional.tarifaDiaria || 0;
    return (parseFloat(horas) * tarifa).toFixed(2);
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop="static"
      dialogClassName="modal-90w"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-calendar-day me-2"></i>
          Asignación Diaria de Profesionales - {obra?.nombre || 'Obra'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Alerts */}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
            {success}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Cargando profesionales...</p>
          </div>
        )}

        {/* Tabla de Profesionales */}
        {/* 🆕 Eliminada la vista antigua - ahora siempre se usa la vista con calendarios y tabs */}

        {/* Vista de Selección de Profesionales */}
        {vistaSeleccion && (
          <div>
            <div className="mb-3 d-flex justify-content-between align-items-center">
              <h6 className="text-primary mb-0">
                <i className="fas fa-user-check me-2"></i>
                Seleccionar Profesionales ({profesionalesSeleccionados.length} seleccionados)
              </h6>
              <Button variant="outline-secondary" size="sm" onClick={handleVolverAFormulario}>
                <i className="fas fa-redo me-2"></i>
                Limpiar Selección
              </Button>
            </div>

            {/* 🆕 Pestañas: Seleccionar de Lista / Agregar Manualmente */}
            <ul className="nav nav-pills mb-4">
              <li className="nav-item">
                <button
                  className={`nav-link ${tabSeleccion === 'lista' ? 'active' : ''}`}
                  style={{
                    background: tabSeleccion === 'lista'
                      ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                      : 'transparent',
                    color: tabSeleccion === 'lista' ? '#fff' : '#6c757d',
                    border: tabSeleccion === 'lista' ? 'none' : '1px solid #dee2e6',
                    fontWeight: 600
                  }}
                  onClick={() => setTabSeleccion('lista')}
                >
                  <i className="fas fa-list me-2"></i>
                  Seleccionar de Lista
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${tabSeleccion === 'manual' ? 'active' : ''}`}
                  style={{
                    background: tabSeleccion === 'manual'
                      ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                      : 'transparent',
                    color: tabSeleccion === 'manual' ? '#fff' : '#6c757d',
                    border: tabSeleccion === 'manual' ? 'none' : '1px solid #dee2e6',
                    fontWeight: 600
                  }}
                  onClick={() => setTabSeleccion('manual')}
                >
                  <i className="fas fa-user-plus me-2"></i>
                  Agregar Manualmente
                </button>
              </li>
            </ul>

            {/* Contenido de la pestaña "Seleccionar de Lista" */}
            {tabSeleccion === 'lista' && (
              <>
                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2">Cargando profesionales...</p>
                  </div>
                ) : (
                  <>
                    <Alert variant="info">
                      <strong>Instrucciones:</strong> Selecciona los profesionales que trabajaron este día.
                      Puedes ajustar la fracción de jornada (1.0 = día completo, 0.5 = medio día) y la tarifa diaria si es necesario.
                    </Alert>

                <Table bordered hover responsive>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '50px' }}></th>
                      <th>Profesional</th>
                      <th>Tipo</th>
                      <th>Obras Asignadas</th>
                      <th style={{ width: '180px' }}>Rubro</th>
                      <th>
                        <div className="d-flex align-items-center justify-content-between">
                          <span>Tarifa Diaria</span>
                          <Form.Check
                            type="switch"
                            id="switch-mostrar-tarifas"
                            label="Mostrar"
                            checked={mostrarTarifas}
                            onChange={(e) => setMostrarTarifas(e.target.checked)}
                            className="ms-2"
                            style={{ fontSize: '0.85em' }}
                          />
                        </div>
                      </th>
                      <th style={{ width: '300px' }}>Fechas y Fracciones</th>
                      <th style={{ width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todosProfesionales.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          No hay profesionales disponibles en la empresa
                        </td>
                      </tr>
                    ) : (
                      todosProfesionales.map(prof => {
                        const seleccionado = profesionalesSeleccionados.find(p => p.id === prof.id);
                        const tarifaReal = seleccionado?.tarifaDiaria ?? prof.honorario ?? 0;
                        const tarifa = mostrarTarifas ? tarifaReal : 0; // 🆕 Mostrar 0 si el switch está OFF
                        const fechasProf = fechasPorProfesional[prof.id] || [];

                        // NUEVO: Calcular total sumando todas las fechas
                        const totalDias = fechasProf.reduce((sum, f) => sum + f.fraccion, 0);
                        const montoTotal = (totalDias * tarifa).toFixed(2);

                        const obrasAsignadas = asignacionesPorProfesional[prof.id] || [];
                        const tieneTarifa = (prof.honorario && prof.honorario > 0);

                        return (
                          <tr key={prof.id} className={seleccionado ? 'table-success' : ''}>
                            <td className="text-center">
                              <Form.Check
                                type="checkbox"
                                checked={!!seleccionado}
                                onChange={() => handleSeleccionarProfesional(prof)}
                              />
                            </td>
                            <td>
                              <div>
                                <strong>{prof.nombre}</strong>
                                {prof.especialidad && (
                                  <div className="text-muted small">{prof.especialidad}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge bg="info">{prof.tipoProfesional || 'N/A'}</Badge>
                            </td>
                            <td>
                              {obrasAsignadas.length > 0 ? (
                                <div className="small">
                                  {obrasAsignadas.map((asig, idx) => {
                                    // Formatear la información de fecha/período
                                    let periodo = '';
                                    if (asig.semana && asig.anio) {
                                      periodo = `Semana ${asig.semana}/${asig.anio}`;
                                    } else if (asig.fechaInicio && asig.fechaFin) {
                                      const inicio = new Date(asig.fechaInicio).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                      const fin = new Date(asig.fechaFin).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                      periodo = `${inicio} - ${fin}`;
                                    } else if (asig.fechaInicio) {
                                      periodo = `Desde ${new Date(asig.fechaInicio).toLocaleDateString('es-AR')}`;
                                    }

                                    const esObraActual = asig.obraId === obra?.id;

                                    return (
                                      <div key={`${asig.asignacionId}-${idx}`} className="mb-1">
                                        <Badge
                                          bg={esObraActual ? 'primary' : 'secondary'}
                                          className="me-1"
                                        >
                                          {asig.obraNombre}
                                        </Badge>
                                        {periodo && (
                                          <span className="text-muted" style={{ fontSize: '0.85em' }}>
                                            ({periodo})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted small">Sin asignaciones</span>
                              )}
                            </td>
                            <td>
                              {seleccionado ? (
                                <RubroSelector
                                  value={seleccionado.rubroNombre || ''}
                                  onChange={(nombreRubro) => handleCambiarRubroSeleccionado(prof.id, nombreRubro)}
                                  placeholder="Seleccionar rubro..."
                                  disabled={false}
                                  rubrosExistentesEnPresupuesto={
                                    profesionalesSeleccionados
                                      .filter(p => p.id !== prof.id && p.rubroNombre)
                                      .map(p => p.rubroNombre)
                                  }
                                  rubrosDelPresupuesto={rubros}
                                />
                              ) : (
                                <span className="text-muted small">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              {seleccionado ? (
                                mostrarTarifas ? (
                                  <div>
                                    <Form.Control
                                      type="number"
                                      size="sm"
                                      step="1000"
                                      min="0"
                                      value={tarifaReal}
                                      onChange={(e) => handleCambiarTarifaSeleccionado(prof.id, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  </div>
                                ) : (
                                  <div>
                                    <strong>$0</strong>
                                    <small className="text-muted d-block mt-1">
                                      Tarifa oculta
                                    </small>
                                  </div>
                                )
                              ) : (
                                <div>
                                  ${tarifa.toLocaleString('es-AR')}
                                </div>
                              )}
                            </td>
                            <td>
                              {seleccionado ? (
                                <div>
                                  {/* NUEVO: Mostrar fechas como chips con fracciones editables */}
                                  <div className="d-flex flex-wrap gap-2 mb-2">
                                    {fechasProf.map(({ fecha: f, fraccion }) => {
                                      const montoFecha = (fraccion * tarifa);
                                      return (
                                        <div key={f} className="d-flex align-items-center gap-1 border rounded p-1" style={{ backgroundColor: '#f0f8ff' }}>
                                          <span className="small text-nowrap">
                                            📅 {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                          </span>
                                          <Form.Select
                                            size="sm"
                                            value={String(fraccion)}
                                            onChange={(e) => handleCambiarFraccionFecha(prof.id, f, e.target.value)}
                                            style={{ width: '120px', padding: '0.15rem 0.3rem', fontSize: '0.85rem' }}
                                          >
                                            <option value="0.25">1/4 día</option>
                                            <option value="0.5">Medio día</option>
                                            <option value="0.75">3/4 día</option>
                                            <option value="1">Día completo</option>
                                            <option value="1.25">1 día y 1/4</option>
                                            <option value="1.5">1 día y 1/2</option>
                                          </Form.Select>
                                          <button
                                            className="btn btn-sm btn-danger p-0"
                                            style={{ width: '20px', height: '20px', fontSize: '0.7rem', lineHeight: '1' }}
                                            onClick={() => handleEliminarFecha(prof.id, f)}
                                            title="Quitar fecha"
                                          >
                                            ✕
                                          </button>
                                          <span className="small text-muted fw-bold">${montoFecha.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* NUEVO: Botón para agregar más fechas */}
                                  <div className="d-flex gap-2 align-items-start flex-column">
                                    {/* Botones de modo de selección */}
                                    <div className="btn-group btn-group-sm" role="group">
                                      <button
                                        type="button"
                                        className={`btn ${modoSeleccion === 'unica' && profesionalEditandoFechas === prof.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => {
                                          setProfesionalEditandoFechas(prof.id);
                                          setModoSeleccion('unica');
                                        }}
                                      >
                                        <i className="fas fa-calendar-day me-1"></i>Fecha única
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn ${modoSeleccion === 'rango' && profesionalEditandoFechas === prof.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => {
                                          setProfesionalEditandoFechas(prof.id);
                                          setModoSeleccion('rango');
                                        }}
                                      >
                                        <i className="fas fa-calendar-week me-1"></i>Rango de fechas
                                      </button>
                                    </div>

                                    {/* Modo: Fecha única */}
                                    {modoSeleccion === 'unica' && profesionalEditandoFechas === prof.id && (
                                      <div className="d-flex gap-1">
                                        <div className="position-relative">
                                          <Form.Control
                                            type="date"
                                            size="sm"
                                            value={nuevaFecha}
                                            onChange={(e) => setNuevaFecha(e.target.value)}
                                            onFocus={(e) => {
                                              // Si está vacío, pre-cargar con la última fecha agregada
                                              if (!nuevaFecha && ultimaFechaAgregada) {
                                                setNuevaFecha(ultimaFechaAgregada);
                                              }
                                            }}
                                            style={{
                                              width: '140px',
                                              borderColor: esFeriado(nuevaFecha) ? '#ffc107' : undefined
                                            }}
                                            title={esFeriado(nuevaFecha) ? '🇦🇷 Feriado Nacional' : ''}
                                          />
                                          {esFeriado(nuevaFecha) && (
                                            <Badge
                                              bg="warning"
                                              text="dark"
                                              className="position-absolute"
                                              style={{
                                                top: '-8px',
                                                right: '-8px',
                                                fontSize: '0.65rem',
                                                padding: '2px 5px'
                                              }}
                                            >
                                              🇦🇷 Feriado
                                            </Badge>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="success"
                                          onClick={() => {
                                            handleAbrirSelectorFechas(prof.id);
                                            handleAgregarFecha();
                                          }}
                                          disabled={!nuevaFecha}
                                          style={{ whiteSpace: 'nowrap' }}
                                        >
                                          <i className="fas fa-check me-1"></i>Agregar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline-primary"
                                          onClick={() => {
                                            handleAbrirSelectorFechas(prof.id);
                                            handleAgregarFechaPendiente();
                                          }}
                                          disabled={!nuevaFecha}
                                          style={{ whiteSpace: 'nowrap' }}
                                        >
                                          <i className="fas fa-list me-1"></i>+ A lista
                                        </Button>
                                        {fechasProf.length > 0 && (
                                          <Button
                                            size="sm"
                                            variant="success"
                                            onClick={() => {
                                              // Guardar solo este profesional
                                              const profSeleccionado = profesionalesSeleccionados.find(p => p.id === prof.id);
                                              if (profSeleccionado && profSeleccionado.fechas && profSeleccionado.fechas.length > 0) {
                                                handleGuardarProfesionalesSeleccionados();
                                              }
                                            }}
                                            disabled={guardando || !seleccionado.rubroNombre || fechasProf.length === 0}
                                            title="Guardar jornal de este profesional"
                                            style={{ whiteSpace: 'nowrap' }}
                                          >
                                            <i className="fas fa-save me-1"></i>Guardar
                                          </Button>
                                        )}
                                      </div>
                                    )}

                                    {/* Modo: Rango de fechas */}
                                    {modoSeleccion === 'rango' && profesionalEditandoFechas === prof.id && (
                                      <div className="d-flex flex-column gap-2" style={{ width: '100%' }}>
                                        <div className="d-flex gap-1 align-items-center flex-wrap">
                                          <div>
                                            <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Desde</small>
                                            <Form.Control
                                              type="date"
                                              size="sm"
                                              value={fechaInicio}
                                              onChange={(e) => {
                                                const nuevaFechaInicio = e.target.value;
                                                setFechaInicio(nuevaFechaInicio);
                                                // Auto-llenar fechaFin con la misma fecha
                                                if (nuevaFechaInicio && !fechaFin) {
                                                  setFechaFin(nuevaFechaInicio);
                                                }
                                              }}
                                              style={{ width: '140px' }}
                                            />
                                          </div>
                                          <div>
                                            <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Hasta</small>
                                            <Form.Control
                                              type="date"
                                              size="sm"
                                              value={fechaFin}
                                              onChange={(e) => setFechaFin(e.target.value)}
                                              style={{ width: '140px' }}
                                            />
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={handleAgregarRangoFechas}
                                            disabled={!fechaInicio || !fechaFin}
                                            style={{ whiteSpace: 'nowrap', marginTop: '18px' }}
                                          >
                                            <i className="fas fa-list me-1"></i>+ A lista
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            onClick={handleAgregarRangoFechasDirecto}
                                            disabled={!fechaInicio || !fechaFin}
                                            style={{ whiteSpace: 'nowrap', marginTop: '18px' }}
                                          >
                                            <i className="fas fa-check me-1"></i>Agregar Rango
                                          </Button>
                                          {fechasProf.length > 0 && (
                                            <Button
                                              size="sm"
                                              variant="success"
                                              onClick={() => {
                                                // Guardar solo este profesional
                                                const profSeleccionado = profesionalesSeleccionados.find(p => p.id === prof.id);
                                                if (profSeleccionado && profSeleccionado.fechas && profSeleccionado.fechas.length > 0) {
                                                  handleGuardarProfesionalesSeleccionados();
                                                }
                                              }}
                                              disabled={guardando || !seleccionado.rubroNombre || fechasProf.length === 0}
                                              title="Guardar jornal de este profesional"
                                              style={{ whiteSpace: 'nowrap', marginTop: '18px' }}
                                            >
                                              <i className="fas fa-save me-1"></i>Guardar
                                            </Button>
                                          )}
                                        </div>
                                        <div className="form-check">
                                          <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={`incluirFinesSemana-${prof.id}`}
                                            checked={incluirFinesSemana}
                                            onChange={(e) => setIncluirFinesSemana(e.target.checked)}
                                          />
                                          <label className="form-check-label small" htmlFor={`incluirFinesSemana-${prof.id}`}>
                                            <i className="fas fa-calendar-week me-1"></i>
                                            Incluir sábados y domingos
                                          </label>
                                        </div>
                                      </div>
                                    )}

                                    {/* Visualización de fechas pendientes (acumuladas antes de confirmar) */}
                                    {profesionalEditandoFechas === prof.id && fechasPendientes.length > 0 && (
                                      <div className="mt-3 p-2 bg-light border rounded">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                          <small className="text-muted fw-bold">
                                            <i className="fas fa-clock me-1"></i>
                                            Fechas pendientes por confirmar:
                                          </small>
                                          <button
                                            className="btn btn-sm btn-outline-secondary py-0 px-1"
                                            onClick={handleLimpiarFechasPendientes}
                                            style={{ fontSize: '0.7rem' }}
                                            title="Limpiar todas las fechas pendientes"
                                          >
                                            <i className="fas fa-trash me-1"></i>Limpiar
                                          </button>
                                        </div>
                                        <div className="d-flex flex-wrap gap-1 mb-2">
                                          {fechasPendientes.map((fecha) => (
                                            <Badge
                                              key={fecha}
                                              bg="primary"
                                              className="d-flex align-items-center gap-1"
                                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                            >
                                              📅 {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit'
                                              })}
                                              {esFeriado(fecha) && (
                                                <span title="Feriado Nacional">🇦🇷</span>
                                              )}
                                              <button
                                                className="btn btn-sm p-0 text-white"
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  fontSize: '0.9rem',
                                                  lineHeight: '1',
                                                  marginLeft: '2px'
                                                }}
                                                onClick={() => handleEliminarFechaPendiente(fecha)}
                                                title="Quitar de la lista"
                                              >
                                                ✕
                                              </button>
                                            </Badge>
                                          ))}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="success"
                                          onClick={handleConfirmarFechasPendientes}
                                          className="w-100"
                                        >
                                          <i className="fas fa-check me-1"></i>
                                          ✓ Confirmar {fechasPendientes.length} fecha{fechasPendientes.length !== 1 ? 's' : ''}
                                        </Button>
                                      </div>
                                    )}

                                    {fechasProf.length === 0 && (
                                      <small className="text-danger d-block">
                                        ⚠️ Agrega al menos una fecha
                                      </small>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              {seleccionado ? (
                                <div>
                                  <strong className="text-success">
                                    ${parseFloat(montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </strong>
                                  {fechasProf.length > 0 && (
                                    <>
                                      <div className="small text-muted">
                                        {totalDias.toFixed(2)} días
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="success"
                                        className="mt-2"
                                        onClick={() => {
                                          // Guardar solo este profesional
                                          const profSeleccionado = profesionalesSeleccionados.find(p => p.id === prof.id);
                                          if (profSeleccionado && profSeleccionado.fechas && profSeleccionado.fechas.length > 0) {
                                            handleGuardarProfesionalesSeleccionados();
                                          }
                                        }}
                                        disabled={guardando || !seleccionado.rubroNombre || fechasProf.length === 0}
                                        title="Guardar jornal de este profesional"
                                      >
                                        <i className="fas fa-save me-1"></i>
                                        Guardar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>

                {profesionalesSeleccionados.length > 0 && (
                  <div className="text-end mt-3">
                    <Button
                      variant="success"
                      size="lg"
                      onClick={handleGuardarProfesionalesSeleccionados}
                      disabled={guardando}
                    >
                      {guardando ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save me-2"></i>
                          Guardar {profesionalesSeleccionados.length} Jornales
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

            {/* Contenido de la pestaña "Agregar Manualmente" */}
            {tabSeleccion === 'manual' && (
              <>
                <Alert variant="info" className="mb-3">
                  <i className="fas fa-lightbulb me-2"></i>
                  <strong>Profesionales temporales:</strong> Los profesionales creados aquí son temporales y solo se agregarán a esta planificación. No se guardarán en el catálogo permanente.
                </Alert>

                {/* Formulario para agregar profesional manual */}
                <div className="card mb-3">
                  <div className="card-body">
                    <h6 className="card-title mb-3">
                      <i className="fas fa-user-plus me-2"></i>
                      Nuevo Profesional Temporal
                    </h6>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">
                          Nombre <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Nombre del profesional"
                          value={profesionalManual.nombre}
                          onChange={(e) => handleCambiarProfesionalManual('nombre', e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Tipo de Profesional <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ej: Albañil, Electricista, Plomero"
                          value={profesionalManual.tipoProfesional}
                          onChange={(e) => handleCambiarProfesionalManual('tipoProfesional', e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Honorario por Día</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={profesionalManual.honorario}
                          onChange={(e) => handleCambiarProfesionalManual('honorario', e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="Ej: +54 9 11 1234-5678"
                          value={profesionalManual.telefono}
                          onChange={(e) => handleCambiarProfesionalManual('telefono', e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="email@ejemplo.com"
                          value={profesionalManual.email}
                          onChange={(e) => handleCambiarProfesionalManual('email', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className={`card ${guardarEnCatalogo ? 'bg-success' : 'bg-light'} border-primary`}>
                        <div className="card-body py-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="guardarEnCatalogo"
                              checked={guardarEnCatalogo}
                              onChange={(e) => setGuardarEnCatalogo(e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="guardarEnCatalogo">
                              <strong className={guardarEnCatalogo ? 'text-white' : ''}>
                                <i className={`fas fa-save me-2 ${guardarEnCatalogo ? 'text-white' : 'text-primary'}`}></i>
                                Guardar en catálogo permanente
                              </strong>
                              <small className={`d-block mt-1 ${guardarEnCatalogo ? 'text-white' : 'text-muted'}`}>
                                {guardarEnCatalogo ? (
                                  <>✅ Se guardará en la base de datos y estará disponible para futuras asignaciones</>
                                ) : (
                                  <>⚠️ Solo se agregará temporalmente a esta asignación (no se guardará en el catálogo)</>
                                )}
                              </small>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-end">
                      <Button
                        variant="success"
                        onClick={handleAgregarProfesionalManual}
                        disabled={guardando}
                      >
                        {guardando ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            {guardarEnCatalogo ? 'Guardando en catálogo...' : 'Agregando...'}
                          </>
                        ) : (
                          <>
                            <i className="fas fa-plus-circle me-2"></i>
                            {guardarEnCatalogo ? 'Guardar en Catálogo Permanente' : 'Agregar Temporalmente'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lista de profesionales temporales agregados */}
                {profesionalesTemporales.length > 0 ? (
                  <div className="card">
                    <div className="card-body">
                      <h6 className="card-title mb-3">
                        <i className="fas fa-users me-2"></i>
                        Profesionales Temporales Agregados ({profesionalesTemporales.length})
                      </h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Tipo</th>
                              <th>Honorario</th>
                              <th>Teléfono</th>
                              <th>Email</th>
                              <th className="text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profesionalesTemporales.map(prof => (
                              <tr key={prof.id}>
                                <td><strong>{prof.nombre}</strong></td>
                                <td><Badge bg="secondary">{prof.tipoProfesional}</Badge></td>
                                <td>${prof.honorario.toLocaleString('es-AR')}</td>
                                <td>{prof.telefono || '-'}</td>
                                <td>{prof.email || '-'}</td>
                                <td className="text-center">
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleEliminarProfesionalTemporal(prof.id)}
                                  >
                                    <i className="fas fa-trash"></i>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-muted small mt-2">
                        <i className="fas fa-info-circle me-1"></i>
                        Estos profesionales están disponibles en la pestaña "Seleccionar de Lista" para asignarlos a jornales.
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert variant="secondary">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay profesionales temporales agregados. Usa el formulario de arriba para crear uno.
                  </Alert>
                )}
              </>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={guardando}>
          <i className="fas fa-times me-2"></i>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleGuardarProfesionalesSeleccionados}
          disabled={guardando || profesionalesSeleccionados.length === 0}
        >
          {guardando ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Guardando...
            </>
          ) : (
            <>
              <i className="fas fa-save me-2"></i>
              Guardar Jornales
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegistrarJornalesDiariosModal;
