import React, { useState, useEffect, useMemo } from 'react';

/**
 * Componente para manejar múltiples configuraciones de presupuesto
 * Permite agregar configuraciones para Profesionales, Materiales y Otros Costos
 * Calcula y muestra el consumo de cada configuración
 */
const ConfiguracionPresupuestoSection = ({
  configsProfesionales = [],
  configsMateriales = [],
  configsOtros = [],
  profesionalesAgregados = [],  // Lista de profesionales agregados al presupuesto
  materialesAgregados = [],      // Lista de materiales agregados al presupuesto
  otrosCostosAgregados = [],     // Lista de otros costos agregados al presupuesto
  itemsCalculadora = [],         // NUEVO: Items de la calculadora
  onConfigsChange,
  soloLectura = false,
  mostrarSolo = 'ambos', // 'ambos', 'presupuestos', 'honorarios', 'mayoresCostos', 'descuentos'
  honorarios = null, // NUEVO: honorarios desde el padre (si existe)
  onHonorariosChange = null, // NUEVO: callback para actualizar honorarios en el padre
  mayoresCostos = null, // NUEVO: mayores costos desde el padre (si existe) - CLON DE HONORARIOS
  onMayoresCostosChange = null, // NUEVO: callback para actualizar mayores costos en el padre - CLON DE HONORARIOS
  descuentos = null, // NUEVO: descuentos desde el padre (si existe)
  onDescuentosChange = null, // NUEVO: callback para actualizar descuentos en el padre
  presupuestoSugeridoProfesionales = null, // Presupuesto sugerido desde cálculo de m²
  presupuestoSugeridoMateriales = null, // Presupuesto sugerido desde cálculo de m²
  presupuestoSugeridoOtros = null // Presupuesto sugerido desde cálculo de m²
}) => {

  // Estados para formularios temporales
  const [showAddConfigProfesional, setShowAddConfigProfesional] = useState(false);
  const [showAddConfigMaterial, setShowAddConfigMaterial] = useState(false);
  const [showAddConfigOtro, setShowAddConfigOtro] = useState(false);

  // Estado para mostrar/ocultar la sección completa de configuraciones
  const [mostrarConfiguraciones, setMostrarConfiguraciones] = useState(false);

  // Estados para mostrar/ocultar cada tipo de configuración
  const [mostrarConfigsProfesionales, setMostrarConfigsProfesionales] = useState(false);
  const [mostrarConfigsMateriales, setMostrarConfigsMateriales] = useState(false);
  const [mostrarConfigsOtros, setMostrarConfigsOtros] = useState(false);

  // Estados para agregar disponible a configuraciones existentes
  const [editingConfigProfesional, setEditingConfigProfesional] = useState(null); // {index, cantidadAdicional, importeAdicional}
  const [editingConfigMaterial, setEditingConfigMaterial] = useState(null); // {index, presupuestoAdicional}
  const [editingConfigOtro, setEditingConfigOtro] = useState(null); // {index, presupuestoAdicional}

  // Estado para conversión de general a específica con selección múltiple
  const [showSeleccionMultiple, setShowSeleccionMultiple] = useState(null); // {configIdx, tiposDisponibles, tiposSeleccionados}
  const [showSeleccionMultipleMaterial, setShowSeleccionMultipleMaterial] = useState(null);
  const [showSeleccionMultipleOtro, setShowSeleccionMultipleOtro] = useState(null);

  // Estado para conversión automática entre modos (ACTIVADO POR DEFECTO)
  const [habilitarConversion, setHabilitarConversion] = useState(true);

  // ========== ESTADOS PARA HONORARIOS ==========
  const [mostrarHonorarios, setMostrarHonorarios] = useState(false); // Colapsado por defecto
  const [configuracionAceptada, setConfiguracionAceptada] = useState(false);
  const [ocultarHonorariosEnPDF, setOcultarHonorariosEnPDF] = useState(true); // NUEVO: Controla si se oculta en PDF (marcado por defecto)
  const [rubroSeleccionado, setRubroSeleccionado] = useState(''); // NUEVO: Para seleccionar rubro específico

  // ✨ NUEVOS ESTADOS PARA APLICACIÓN GLOBAL
  const [aplicarGlobalHonorarios, setAplicarGlobalHonorarios] = useState(false); // Switch para aplicar mismo % a todos
  const [valorGlobalHonorarios, setValorGlobalHonorarios] = useState(''); // Valor global a aplicar
  const [tipoGlobalHonorarios, setTipoGlobalHonorarios] = useState('porcentaje'); // Tipo: 'porcentaje' o 'fijo'

  // ========== ESTADOS PARA MAYORES COSTOS (CLON EXACTO DE HONORARIOS) ==========
  const [mostrarMayoresCostos, setMostrarMayoresCostos] = useState(false); // Colapsado por defecto
  const [configuracionMayoresCostosAceptada, setConfiguracionMayoresCostosAceptada] = useState(false);
  const [ocultarMayoresCostosEnPDF, setOcultarMayoresCostosEnPDF] = useState(true); // NUEVO: Controla si se oculta en PDF (marcado por defecto)
  const [rubroMayoresCostosSeleccionado, setRubroMayoresCostosSeleccionado] = useState(''); // NUEVO: Para seleccionar rubro específico

  // ✨ NUEVOS ESTADOS PARA APLICACIÓN GLOBAL DE MAYORES COSTOS
  const [aplicarGlobalMayoresCostos, setAplicarGlobalMayoresCostos] = useState(false); // Switch para aplicar mismo % a todos
  const [valorGlobalMayoresCostos, setValorGlobalMayoresCostos] = useState(''); // Valor global a aplicar
  const [tipoGlobalMayoresCostos, setTipoGlobalMayoresCostos] = useState('porcentaje'); // Tipo: 'porcentaje' o 'fijo'

  // ========== ESTADOS PARA DESCUENTOS (SIMILAR A MAYORES COSTOS PERO RESTA EN LUGAR DE SUMAR) ==========
  const [mostrarDescuentos, setMostrarDescuentos] = useState(false); // Colapsado por defecto
  const [configuracionDescuentosAceptada, setConfiguracionDescuentosAceptada] = useState(false);
  const [ocultarDescuentosEnPDF, setOcultarDescuentosEnPDF] = useState(true); // Controla si se oculta en PDF (marcado por defecto)

  // ✨ ESTADOS PARA APLICACIÓN GLOBAL DE DESCUENTOS
  const [aplicarGlobalDescuentos, setAplicarGlobalDescuentos] = useState(false); // Switch para aplicar mismo % a todos
  const [valorGlobalDescuentos, setValorGlobalDescuentos] = useState(''); // Valor global a aplicar
  const [tipoGlobalDescuentos, setTipoGlobalDescuentos] = useState('porcentaje'); // Tipo: 'porcentaje' o 'fijo'

  // ========== ESTADOS PARA COLAPSAR TARJETAS DE ESCASO USO ==========
  const [colapsadoProfesionalesHonorarios, setColapsadoProfesionalesHonorarios] = useState(true); // Colapsado por defecto
  const [colapsadoConfigPresupuestoHonorarios, setColapsadoConfigPresupuestoHonorarios] = useState(true); // Colapsado por defecto
  const [colapsadoProfesionalesMayoresCostos, setColapsadoProfesionalesMayoresCostos] = useState(true); // Colapsado por defecto
  const [colapsadoConfigPresupuestoMayoresCostos, setColapsadoConfigPresupuestoMayoresCostos] = useState(true); // Colapsado por defecto

  // Función para cargar valores guardados de honorarios para un rubro específico
  const cargarValoresGuardadosHonorarios = (tipoProfesional) => {
    if (!tipoProfesional) return null;
    try {
      const clave = `honorarios_${tipoProfesional.toLowerCase().replace(/\s+/g, '_')}`;
      const valoresGuardados = localStorage.getItem(clave);
      return valoresGuardados ? JSON.parse(valoresGuardados) : null;
    } catch (error) {
      console.warn('Error al cargar valores guardados de honorarios:', error);
      return null;
    }
  };

  // Función para guardar valores de honorarios para un rubro específico
  const guardarValoresHonorarios = (tipoProfesional, valores) => {
    if (!tipoProfesional) return;
    try {
      const clave = `honorarios_${tipoProfesional.toLowerCase().replace(/\s+/g, '_')}`;
      localStorage.setItem(clave, JSON.stringify(valores));
      console.log(`💾 Valores de honorarios guardados para ${tipoProfesional}:`, valores);
    } catch (error) {
      console.warn('Error al guardar valores de honorarios:', error);
    }
  };

  // Usar honorarios desde props con MERGE a defaults para evitar null/undefined en sub-objetos
  const defaultsHonorarios = {
    valorGeneral: '',
    tipoGeneral: 'porcentaje',
    generalImportado: false,
    jornales: { activo: true, tipo: 'porcentaje', valor: '', modoAplicacion: 'todos', porRol: {} }, // NUEVO: Soporte para jornales con configuración por rol
    profesionales: { activo: true, tipo: 'porcentaje', valor: '' },
    materiales: { activo: true, tipo: 'porcentaje', valor: '' },
    otrosCostos: { activo: true, tipo: 'porcentaje', valor: '' },
    configuracionPresupuesto: { activo: true, tipo: 'porcentaje', valor: '' }
  };

  // console.log('🎯 HONORARIOS RECIBIDOS EN ConfiguracionPresupuestoSection:', honorarios);
  // console.log('🎯 Jornales desde props:', honorarios?.jornales);

  const honorariosActual = {
    ...defaultsHonorarios,
    ...(honorarios || {}),
    generalImportado: (honorarios && typeof honorarios.generalImportado !== 'undefined') ? honorarios.generalImportado : false,
    jornales: {
      ...defaultsHonorarios.jornales,
      ...(honorarios?.jornales || {}),
      porRol: { ...defaultsHonorarios.jornales.porRol, ...(honorarios?.jornales?.porRol || {}) }
    },
    profesionales: { ...defaultsHonorarios.profesionales, ...(honorarios?.profesionales || {}) },
    materiales: { ...defaultsHonorarios.materiales, ...(honorarios?.materiales || {}) },
    otrosCostos: { ...defaultsHonorarios.otrosCostos, ...(honorarios?.otrosCostos || {}) },
    configuracionPresupuesto: { ...defaultsHonorarios.configuracionPresupuesto, ...(honorarios?.configuracionPresupuesto || {}) }
  };

  // console.log('🎯 honorariosActual.jornales DESPUÉS DEL MERGE:', honorariosActual.jornales);

  // ========== FUNCIONES Y DEFAULTS PARA MAYORES COSTOS (CLON EXACTO DE HONORARIOS) ==========

  // Función para cargar valores guardados de mayores costos para un rubro específico
  const cargarValoresGuardadosMayoresCostos = (tipoProfesional) => {
    if (!tipoProfesional) return null;
    try {
      const clave = `mayorescostos_${tipoProfesional.toLowerCase().replace(/\s+/g, '_')}`;
      const valoresGuardados = localStorage.getItem(clave);
      return valoresGuardados ? JSON.parse(valoresGuardados) : null;
    } catch (error) {
      console.warn('Error al cargar valores guardados de mayores costos:', error);
      return null;
    }
  };

  // Función para guardar valores de mayores costos para un rubro específico
  const guardarValoresMayoresCostos = (tipoProfesional, valores) => {
    if (!tipoProfesional) return;
    try {
      const clave = `mayorescostos_${tipoProfesional.toLowerCase().replace(/\s+/g, '_')}`;
      localStorage.setItem(clave, JSON.stringify(valores));
      console.log(`💾 Valores de mayores costos guardados para ${tipoProfesional}:`, valores);
    } catch (error) {
      console.warn('Error al guardar valores de mayores costos:', error);
    }
  };

  // Usar mayores costos desde props con MERGE a defaults para evitar null/undefined en sub-objetos
  const defaultsMayoresCostos = {
    generalImportado: false,
    explicacion: '', // NUEVO: campo para explicar por qué se aplican mayores costos
    jornales: { activo: true, tipo: 'porcentaje', valor: '', modoAplicacion: 'todos', porRol: {} }, // NUEVO: Soporte para jornales con configuración por rol
    profesionales: { activo: true, tipo: 'porcentaje', valor: '' },
    materiales: { activo: true, tipo: 'porcentaje', valor: '' },
    otrosCostos: { activo: true, tipo: 'porcentaje', valor: '' },
    configuracionPresupuesto: { activo: true, tipo: 'porcentaje', valor: '' },
    honorarios: { activo: true, tipo: 'porcentaje', valor: '' }
  };

  const mayoresCostosActual = {
    ...defaultsMayoresCostos,
    generalImportado: (mayoresCostos && typeof mayoresCostos.generalImportado !== 'undefined') ? mayoresCostos.generalImportado : false,
    explicacion: mayoresCostos?.explicacion || '', // Preservar explicación
    jornales: {
      tipo: mayoresCostos?.jornales?.tipo || defaultsMayoresCostos.jornales.tipo,
      valor: mayoresCostos?.jornales?.valor || defaultsMayoresCostos.jornales.valor,
      modoAplicacion: mayoresCostos?.jornales?.modoAplicacion || defaultsMayoresCostos.jornales.modoAplicacion,
      porRol: { ...defaultsMayoresCostos.jornales.porRol, ...(mayoresCostos?.jornales?.porRol || {}) },
      activo: true // ✅ SIEMPRE true - Forzado para todos los presupuestos
    },
    profesionales: {
      ...defaultsMayoresCostos.profesionales,
      ...(mayoresCostos?.profesionales || {}),
      activo: (mayoresCostos?.profesionales?.activo === false) ? false : true // ✅ true por defecto
    },
    materiales: {
      ...defaultsMayoresCostos.materiales,
      ...(mayoresCostos?.materiales || {}),
      activo: (mayoresCostos?.materiales?.activo === false) ? false : true // ✅ true por defecto
    },
    otrosCostos: {
      ...defaultsMayoresCostos.otrosCostos,
      ...(mayoresCostos?.otrosCostos || {}),
      activo: (mayoresCostos?.otrosCostos?.activo === false) ? false : true // ✅ true por defecto
    },
    configuracionPresupuesto: {
      ...defaultsMayoresCostos.configuracionPresupuesto,
      ...(mayoresCostos?.configuracionPresupuesto || {}),
      activo: (mayoresCostos?.configuracionPresupuesto?.activo === false) ? false : true // ✅ true por defecto
    },
    honorarios: {
      ...defaultsMayoresCostos.honorarios,
      ...(mayoresCostos?.honorarios || {}),
      activo: (mayoresCostos?.honorarios?.activo === false) ? false : true // ✅ true por defecto
    }
  };

  // Función para actualizar honorarios (usa callback si existe, sino no hace nada)
  const setHonorarios = (updater) => {
    if (onHonorariosChange) {
      const nuevoValor = typeof updater === 'function' ? updater(honorariosActual) : updater;
      onHonorariosChange(nuevoValor);
    }
    // Resetear el estado de configuración aceptada cuando se edita cualquier campo
    setConfiguracionAceptada(false);
  };

  // ✨ useEffect para aplicar valor global cuando cambia el tipo
  useEffect(() => {
    if (aplicarGlobalHonorarios && valorGlobalHonorarios && onHonorariosChange) {
      const nuevoHonorarios = {
        ...honorariosActual,
        jornales: { ...honorariosActual.jornales, tipo: tipoGlobalHonorarios, valor: valorGlobalHonorarios },
        profesionales: { ...honorariosActual.profesionales, tipo: tipoGlobalHonorarios, valor: valorGlobalHonorarios },
        materiales: { ...honorariosActual.materiales, tipo: tipoGlobalHonorarios, valor: valorGlobalHonorarios },
        otrosCostos: { ...honorariosActual.otrosCostos, tipo: tipoGlobalHonorarios, valor: valorGlobalHonorarios },
        configuracionPresupuesto: { ...honorariosActual.configuracionPresupuesto, tipo: tipoGlobalHonorarios, valor: valorGlobalHonorarios }
      };
      onHonorariosChange(nuevoHonorarios);
    }
  }, [tipoGlobalHonorarios]); // Solo cuando cambia el tipo

  // FUNCIÓN SET MAYORES COSTOS - CLON EXACTO DE HONORARIOS
  const setMayoresCostos = (updater) => {
    if (onMayoresCostosChange) {
      const nuevoValor = typeof updater === 'function' ? updater(mayoresCostosActual) : updater;
      onMayoresCostosChange(nuevoValor);
      // Mostrar alerta visual si el presupuesto está en estado APROBADO o EN_EJECUCION
      if (typeof window !== 'undefined' && window.showNotification && window.presupuestoActual &&
          (window.presupuestoActual.estado === 'APROBADO' || window.presupuestoActual.estado === 'EN_EJECUCION')) {
        window.showNotification('✅ Cambios guardados. Se actualizó el presupuesto y se registró auditoría.', 'success');
      }
    }
    // Resetear el estado de configuración aceptada cuando se edita cualquier campo
    setConfiguracionMayoresCostosAceptada(false);
  };

  // ✨ useEffect para inicializar mayores costos con valores por defecto si no existen
  useEffect(() => {
    if (onMayoresCostosChange && (!mayoresCostos || !mayoresCostos.jornales || typeof mayoresCostos.jornales.activo === 'undefined')) {
      // Solo inicializar si los valores no están definidos correctamente
      onMayoresCostosChange(mayoresCostosActual);
    }
  }, []); // Solo al montar el componente

  // ✨ useEffect para aplicar valor global de mayores costos cuando cambia el tipo
  useEffect(() => {
    if (aplicarGlobalMayoresCostos && valorGlobalMayoresCostos && onMayoresCostosChange) {
      const nuevoMayoresCostos = {
        ...mayoresCostosActual,
        jornales: { ...mayoresCostosActual.jornales, tipo: tipoGlobalMayoresCostos, valor: valorGlobalMayoresCostos },
        profesionales: { ...mayoresCostosActual.profesionales, tipo: tipoGlobalMayoresCostos, valor: valorGlobalMayoresCostos },
        materiales: { ...mayoresCostosActual.materiales, tipo: tipoGlobalMayoresCostos, valor: valorGlobalMayoresCostos },
        otrosCostos: { ...mayoresCostosActual.otrosCostos, tipo: tipoGlobalMayoresCostos, valor: valorGlobalMayoresCostos },
        configuracionPresupuesto: { ...mayoresCostosActual.configuracionPresupuesto, tipo: tipoGlobalMayoresCostos, valor: valorGlobalMayoresCostos },
        honorarios: { ...mayoresCostosActual.honorarios, tipo: tipoGlobalMayoresCostos, valor: valorGlobalMayoresCostos }
      };
      onMayoresCostosChange(nuevoMayoresCostos);
    }
  }, [tipoGlobalMayoresCostos]); // Solo cuando cambia el tipo

  // ========== DEFAULTS Y FUNCIONES PARA DESCUENTOS ==========
  const defaultsDescuentos = {
    explicacion: '', // Campo para explicar por qué se aplican descuentos
    jornales: { activo: true, tipo: 'porcentaje', valor: '' },
    materiales: { activo: true, tipo: 'porcentaje', valor: '' },
    // Honorarios desglosados por sub-tipo (para aplicar descuento individual por tipo de honorario)
    honorariosJornales: { activo: true, tipo: 'porcentaje', valor: '' },
    honorariosProfesionales: { activo: true, tipo: 'porcentaje', valor: '' },
    honorariosMateriales: { activo: true, tipo: 'porcentaje', valor: '' },
    honorariosOtros: { activo: true, tipo: 'porcentaje', valor: '' },
    honorariosGastosGenerales: { activo: true, tipo: 'porcentaje', valor: '' },
    honorariosConfiguracion: { activo: true, tipo: 'porcentaje', valor: '' },
    honorarios: { activo: true, tipo: 'porcentaje', valor: '' }, // Legacy / backward compat
    mayoresCostos: { activo: true, tipo: 'porcentaje', valor: '' } // Nueva tarjeta para descuentos sobre mayores costos
  };

  // � CAMBIO: Usar useMemo para que descuentosActual sea reactivo y se actualice cuando cambien las props
  const [descuentosActual, setDescuentosActualState] = useState(() => ({
    ...defaultsDescuentos,
    explicacion: descuentos?.explicacion || '',
    jornales: {
      ...defaultsDescuentos.jornales,
      ...(descuentos?.jornales || {}),
      activo: (descuentos?.jornales?.activo === false) ? false : true
    },
    materiales: {
      ...defaultsDescuentos.materiales,
      ...(descuentos?.materiales || {}),
      activo: (descuentos?.materiales?.activo === false) ? false : true
    },
    // Honorarios desglosados por sub-tipo
    honorariosJornales: {
      ...defaultsDescuentos.honorariosJornales,
      ...(descuentos?.honorariosJornales || {}),
      activo: (descuentos?.honorariosJornales?.activo === false) ? false : true
    },
    honorariosProfesionales: {
      ...defaultsDescuentos.honorariosProfesionales,
      ...(descuentos?.honorariosProfesionales || {}),
      activo: (descuentos?.honorariosProfesionales?.activo === false) ? false : true
    },
    honorariosMateriales: {
      ...defaultsDescuentos.honorariosMateriales,
      ...(descuentos?.honorariosMateriales || {}),
      activo: (descuentos?.honorariosMateriales?.activo === false) ? false : true
    },
    honorariosOtros: {
      ...defaultsDescuentos.honorariosOtros,
      ...(descuentos?.honorariosOtros || {}),
      activo: (descuentos?.honorariosOtros?.activo === false) ? false : true
    },
    honorariosGastosGenerales: {
      ...defaultsDescuentos.honorariosGastosGenerales,
      ...(descuentos?.honorariosGastosGenerales || {}),
      activo: (descuentos?.honorariosGastosGenerales?.activo === false) ? false : true
    },
    honorariosConfiguracion: {
      ...defaultsDescuentos.honorariosConfiguracion,
      ...(descuentos?.honorariosConfiguracion || {}),
      activo: (descuentos?.honorariosConfiguracion?.activo === false) ? false : true
    },
    honorarios: {
      ...defaultsDescuentos.honorarios,
      ...(descuentos?.honorarios || {}),
      activo: (descuentos?.honorarios?.activo === false) ? false : true
    },
    mayoresCostos: {
      ...defaultsDescuentos.mayoresCostos,
      ...(descuentos?.mayoresCostos || {}),
      activo: (descuentos?.mayoresCostos?.activo === false) ? false : true
    }
  }));

  // 🔧 Sincronizar descuentosActual cuando cambien las props descuentos
  useEffect(() => {
    if (descuentos) {
      const actualizado = {
        ...defaultsDescuentos,
        explicacion: descuentos?.explicacion || '',
        jornales: {
          ...defaultsDescuentos.jornales,
          ...(descuentos?.jornales || {}),
          activo: (descuentos?.jornales?.activo === false) ? false : true
        },
        materiales: {
          ...defaultsDescuentos.materiales,
          ...(descuentos?.materiales || {}),
          activo: (descuentos?.materiales?.activo === false) ? false : true
        },
        // Honorarios desglosados por sub-tipo
        honorariosJornales: {
          ...defaultsDescuentos.honorariosJornales,
          ...(descuentos?.honorariosJornales || {}),
          activo: (descuentos?.honorariosJornales?.activo === false) ? false : true
        },
        honorariosProfesionales: {
          ...defaultsDescuentos.honorariosProfesionales,
          ...(descuentos?.honorariosProfesionales || {}),
          activo: (descuentos?.honorariosProfesionales?.activo === false) ? false : true
        },
        honorariosMateriales: {
          ...defaultsDescuentos.honorariosMateriales,
          ...(descuentos?.honorariosMateriales || {}),
          activo: (descuentos?.honorariosMateriales?.activo === false) ? false : true
        },
        honorariosOtros: {
          ...defaultsDescuentos.honorariosOtros,
          ...(descuentos?.honorariosOtros || {}),
          activo: (descuentos?.honorariosOtros?.activo === false) ? false : true
        },
        honorariosGastosGenerales: {
          ...defaultsDescuentos.honorariosGastosGenerales,
          ...(descuentos?.honorariosGastosGenerales || {}),
          activo: (descuentos?.honorariosGastosGenerales?.activo === false) ? false : true
        },
        honorariosConfiguracion: {
          ...defaultsDescuentos.honorariosConfiguracion,
          ...(descuentos?.honorariosConfiguracion || {}),
          activo: (descuentos?.honorariosConfiguracion?.activo === false) ? false : true
        },
        honorarios: {
          ...defaultsDescuentos.honorarios,
          ...(descuentos?.honorarios || {}),
          activo: (descuentos?.honorarios?.activo === false) ? false : true
        },
        mayoresCostos: {
          ...defaultsDescuentos.mayoresCostos,
          ...(descuentos?.mayoresCostos || {}),
          activo: (descuentos?.mayoresCostos?.activo === false) ? false : true
        }
      };

      console.log('✅ [useEffect-descuentos] Sincronizando:', actualizado.jornales.valor);
      setDescuentosActualState(actualizado);
    }
  }, [descuentos]);

  // Función para actualizar descuentos
  const setDescuentos = (updater) => {
    if (onDescuentosChange) {
      const nuevoValor = typeof updater === 'function' ? updater(descuentosActual) : updater;
      onDescuentosChange(nuevoValor);
    }
    setConfiguracionDescuentosAceptada(false);
  };

  // ✨ useEffect para aplicar valor global de descuentos cuando cambia el tipo
  useEffect(() => {
    if (aplicarGlobalDescuentos && valorGlobalDescuentos && onDescuentosChange) {
      const nuevoDescuentos = {
        ...descuentosActual,
        jornales: { ...descuentosActual.jornales, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        materiales: { ...descuentosActual.materiales, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorariosJornales: { ...descuentosActual.honorariosJornales, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorariosProfesionales: { ...descuentosActual.honorariosProfesionales, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorariosMateriales: { ...descuentosActual.honorariosMateriales, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorariosOtros: { ...descuentosActual.honorariosOtros, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorariosGastosGenerales: { ...descuentosActual.honorariosGastosGenerales, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorariosConfiguracion: { ...descuentosActual.honorariosConfiguracion, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        honorarios: { ...descuentosActual.honorarios, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos },
        mayoresCostos: { ...descuentosActual.mayoresCostos, tipo: tipoGlobalDescuentos, valor: valorGlobalDescuentos }
      };
      onDescuentosChange(nuevoDescuentos);
    }
  }, [tipoGlobalDescuentos]); // Solo cuando cambia el tipo

  // Determinar el rubro actual para cargar valores guardados
  const rubroActual = honorariosActual?.nombreRubroImportado ||
                     (honorariosActual?.rubroImportado && itemsCalculadora?.find(item =>
                       (item.id || itemsCalculadora.indexOf(item)) == honorariosActual.rubroImportado
                     )?.tipoProfesional);

  // Cargar valores guardados para el rubro actual
  const valoresGuardados = cargarValoresGuardadosHonorarios(rubroActual);

  // useEffect para aplicar valores guardados cuando se detecta un rubro
  React.useEffect(() => {
    try {
      if (rubroActual && valoresGuardados && onHonorariosChange) {
        // Solo aplicar si los valores actuales están vacíos (para no sobreescribir valores ya configurados)
        const deberiaAplicarValores = !honorariosActual.profesionales?.valor &&
                                     !honorariosActual.materiales?.valor &&
                                     !honorariosActual.otrosCostos?.valor &&
                                     !honorariosActual.configuracionPresupuesto?.valor;

        if (deberiaAplicarValores) {
          setHonorarios(prev => ({
            ...prev,
            profesionales: {
              ...prev.profesionales,
              tipo: valoresGuardados.profesionales?.tipo || prev.profesionales?.tipo || 'porcentaje',
              valor: valoresGuardados.profesionales?.valor || prev.profesionales?.valor || ''
            },
            materiales: {
              ...prev.materiales,
              tipo: valoresGuardados.materiales?.tipo || prev.materiales?.tipo || 'porcentaje',
              valor: valoresGuardados.materiales?.valor || prev.materiales?.valor || ''
            },
            otrosCostos: {
              ...prev.otrosCostos,
              tipo: valoresGuardados.otrosCostos?.tipo || prev.otrosCostos?.tipo || 'porcentaje',
              valor: valoresGuardados.otrosCostos?.valor || prev.otrosCostos?.valor || ''
            },
            configuracionPresupuesto: {
              ...prev.configuracionPresupuesto,
              tipo: valoresGuardados.configuracionPresupuesto?.tipo || prev.configuracionPresupuesto?.tipo || 'porcentaje',
              valor: valoresGuardados.configuracionPresupuesto?.valor || prev.configuracionPresupuesto?.valor || ''
            }
          }));
        }
      }
    } catch (error) {
      console.warn('Error al aplicar valores guardados de honorarios:', error);
    }
  }, [rubroActual, valoresGuardados ? JSON.stringify(valoresGuardados) : null]);

  // Configuración temporal de profesional
  const [newConfigProfesional, setNewConfigProfesional] = useState({
    tipoProfesional: '',
    importeHora: '',
    importeDia: '',
    importeSemana: '',
    importeMes: '',
    cantidadHoras: '',
    cantidadDias: '',
    cantidadSemanas: '',
    cantidadMeses: '',
    modoSeleccionado: 'hora',  // FORZADO A 'hora' - único modo permitido
    esGeneral: true,  // TILDADO POR DEFECTO: Configuración general (pool común)
    metrosCuadrados: '',  // Metros cuadrados
    importePorMetroCuadrado: ''  // Importe por m²
  });

  // Configuración temporal de material
  const [newConfigMaterial, setNewConfigMaterial] = useState({
    tipoMaterial: '',
    presupuestoTotal: '',
    esGeneral: true,  // TILDADO POR DEFECTO: Configuración general (pool común)
    metrosCuadrados: '',  // Metros cuadrados
    importePorMetroCuadrado: ''  // Importe por m²
  });

  // Configuración temporal de otros costos
  const [newConfigOtro, setNewConfigOtro] = useState({
    descripcion: '',
    rubro: '',  // NUEVO: Rubro al que se aplica (de itemsCalculadora)
    presupuestoTotal: '',
    esGeneral: true,  // TILDADO POR DEFECTO: Configuración general (pool común)
    metrosCuadrados: '',  // Metros cuadrados
    importePorMetroCuadrado: ''  // Importe por m²
  });

  // ========== EFECTOS PARA AUTO-RELLENAR CON PRESUPUESTOS SUGERIDOS ==========

  // Auto-rellenar presupuesto de profesionales cuando se abre el formulario y hay sugerencia
  useEffect(() => {
    if (showAddConfigProfesional && presupuestoSugeridoProfesionales) {
      // Solo auto-completar si los campos están vacíos
      if (!newConfigProfesional.importeHora && !newConfigProfesional.cantidadHoras) {
        // Sugerencia: Asignar el total como "presupuesto disponible"
        // El usuario podrá editarlo libremente
        setNewConfigProfesional(prev => ({
          ...prev,
          cantidadHoras: 1, // Inicializar en 1 hora como ejemplo
          importeHora: presupuestoSugeridoProfesionales.toFixed(2) // El total sugerido como importe por hora inicial
        }));
      }
    }
  }, [showAddConfigProfesional, presupuestoSugeridoProfesionales]);

  // Auto-rellenar presupuesto de materiales cuando se abre el formulario y hay sugerencia
  useEffect(() => {
    if (showAddConfigMaterial && presupuestoSugeridoMateriales) {
      if (!newConfigMaterial.presupuestoTotal) {
        setNewConfigMaterial(prev => ({
          ...prev,
          presupuestoTotal: presupuestoSugeridoMateriales.toFixed(2)
        }));
      }
    }
  }, [showAddConfigMaterial, presupuestoSugeridoMateriales]);

  // Auto-rellenar presupuesto de otros costos cuando se abre el formulario y hay sugerencia
  useEffect(() => {
    if (showAddConfigOtro && presupuestoSugeridoOtros) {
      if (!newConfigOtro.presupuestoTotal) {
        setNewConfigOtro(prev => ({
          ...prev,
          presupuestoTotal: presupuestoSugeridoOtros.toFixed(2)
        }));
      }
    }
  }, [showAddConfigOtro, presupuestoSugeridoOtros]);

  // ========== FUNCIONES DE CÁLCULO DE CONSUMO ==========

  /**
   * Convierte tiempo de un modo a otro
   * Factores de conversión: 1 día = 8 horas, 1 semana = 40 horas, 1 mes = 160 horas
   */
  const convertirTiempo = (cantidad, modoOrigen, modoDestino) => {
    if (modoOrigen === modoDestino) return cantidad;

    // Primero convertir todo a horas
    let horas = cantidad;
    if (modoOrigen === 'dia') horas = cantidad * 8;
    else if (modoOrigen === 'semana') horas = cantidad * 40;
    else if (modoOrigen === 'mes') horas = cantidad * 160;

    // Luego convertir de horas al modo destino
    if (modoDestino === 'hora') return horas;
    if (modoDestino === 'dia') return horas / 8;
    if (modoDestino === 'semana') return horas / 40;
    if (modoDestino === 'mes') return horas / 160;

    return cantidad;
  };

  /**
   * Calcula el consumo de una configuración de profesional específica
   * basado en los profesionales agregados que coincidan con el tipo y modo
   * Si es configuración general (esGeneral=true), suma TODOS los profesionales del modo especificado
   * Si habilitarConversion=true, convierte entre horas/días/semanas/meses automáticamente
   */
  const calcularConsumoProfesional = (config) => {
    let totalTiempoConsumido = 0;
    let totalImporteConsumido = 0;

    profesionalesAgregados.forEach(prof => {
      // Determinar si este profesional debe contarse en esta configuración
      let debeContar = false;

      if (config.esGeneral) {
        // Si es configuración GENERAL, solo cuenta profesionales que NO tienen configuración específica
        const tieneConfigEspecifica = configsProfesionales.some(
          c => !c.esGeneral &&
               c.tipoProfesional?.toLowerCase() === prof.tipoProfesional?.toLowerCase()
        );
        debeContar = !tieneConfigEspecifica; // Solo si NO tiene config específica
      } else {
        // Si es configuración específica, solo cuenta profesionales del tipo exacto
        debeContar = prof.tipoProfesional?.toLowerCase() === config.tipoProfesional?.toLowerCase();
      }

      if (debeContar) {
        // Procesar cada modo del profesional
        if (prof.importeXHora && Number(prof.cantidadHoras || 0) > 0) {
          const cantidad = Number(prof.cantidadHoras || 0);
          const importe = Number(prof.importeXHora || 0) * cantidad;

          if (habilitarConversion) {
            // Convertir horas al modo de la configuración
            const cantidadConvertida = convertirTiempo(cantidad, 'hora', config.modoSeleccionado);
            totalTiempoConsumido += cantidadConvertida;
            totalImporteConsumido += importe;
          } else {
            // Sin conversión: solo cuenta si coincide el modo exacto
            if (config.modoSeleccionado === 'hora') {
              totalTiempoConsumido += cantidad;
              totalImporteConsumido += importe;
            }
          }
        }

        if (prof.importeXDia && Number(prof.cantidadDias || 0) > 0) {
          const cantidad = Number(prof.cantidadDias || 0);
          const importe = Number(prof.importeXDia || 0) * cantidad;

          if (habilitarConversion) {
            const cantidadConvertida = convertirTiempo(cantidad, 'dia', config.modoSeleccionado);
            totalTiempoConsumido += cantidadConvertida;
            totalImporteConsumido += importe;
          } else {
            if (config.modoSeleccionado === 'dia') {
              totalTiempoConsumido += cantidad;
              totalImporteConsumido += importe;
            }
          }
        }

        if (prof.importeXSemana && Number(prof.cantidadSemanas || 0) > 0) {
          const cantidad = Number(prof.cantidadSemanas || 0);
          const importe = Number(prof.importeXSemana || 0) * cantidad;

          if (habilitarConversion) {
            const cantidadConvertida = convertirTiempo(cantidad, 'semana', config.modoSeleccionado);
            totalTiempoConsumido += cantidadConvertida;
            totalImporteConsumido += importe;
          } else {
            if (config.modoSeleccionado === 'semana') {
              totalTiempoConsumido += cantidad;
              totalImporteConsumido += importe;
            }
          }
        }

        if (prof.importeXMes && Number(prof.cantidadMeses || 0) > 0) {
          const cantidad = Number(prof.cantidadMeses || 0);
          const importe = Number(prof.importeXMes || 0) * cantidad;

          if (habilitarConversion) {
            const cantidadConvertida = convertirTiempo(cantidad, 'mes', config.modoSeleccionado);
            totalTiempoConsumido += cantidadConvertida;
            totalImporteConsumido += importe;
          } else {
            if (config.modoSeleccionado === 'mes') {
              totalTiempoConsumido += cantidad;
              totalImporteConsumido += importe;
            }
          }
        }
      }
    });

    return { totalTiempoConsumido, totalImporteConsumido };
  };

  /**
   * Calcula el consumo de una configuración de material específica
   */
  /**
   * Calcula el consumo de una configuración de material específica
   * Si es configuración general (esGeneral=true), suma TODOS los materiales que no tengan configuración específica
   */
  const calcularConsumoMaterial = (config) => {
    let totalConsumido = 0;

    materialesAgregados.forEach(mat => {
      // Determinar si este material debe contarse en esta configuración
      let debeContar = false;

      if (config.esGeneral) {
        // Si es configuración GENERAL, solo cuenta materiales que NO tienen configuración específica
        const tieneConfigEspecifica = configsMateriales.some(
          c => !c.esGeneral &&
               c.tipoMaterial?.toLowerCase() === mat.tipoMaterial?.toLowerCase()
        );
        debeContar = !tieneConfigEspecifica;
      } else {
        // Si es configuración ESPECÍFICA, solo cuenta si el tipo coincide exactamente
        debeContar = mat.tipoMaterial?.toLowerCase() === config.tipoMaterial?.toLowerCase();
      }

      if (debeContar) {
        const cantidad = Number(mat.cantidad || 0);
        const precioUnitario = Number(mat.precioUnitario || 0);
        totalConsumido += cantidad * precioUnitario;
      }
    });

    return totalConsumido;
  };

  /**
   * Calcula el consumo de una configuración de otros costos específica
   * Si es configuración general (esGeneral=true), suma TODOS los costos que no tengan configuración específica
   */
  const calcularConsumoOtro = (config) => {
    let totalConsumido = 0;

    otrosCostosAgregados.forEach(otro => {
      // Determinar si este costo debe contarse en esta configuración
      let debeContar = false;

      if (config.esGeneral) {
        // Si es configuración GENERAL, solo cuenta costos que NO tienen configuración específica
        const tieneConfigEspecifica = configsOtros.some(
          c => !c.esGeneral &&
               otro.descripcion?.toLowerCase().includes(c.descripcion?.toLowerCase())
        );
        debeContar = !tieneConfigEspecifica;
      } else {
        // Si es configuración ESPECÍFICA, solo cuenta si la descripción coincide
        debeContar = otro.descripcion?.toLowerCase().includes(config.descripcion?.toLowerCase());
      }

      if (debeContar) {
        totalConsumido += Number(otro.importe || otro.monto || 0);
      }
    });

    return totalConsumido;
  };

  // ========== FUNCIONES DE CÁLCULO DE TOTALES Y HONORARIOS ==========

  /**
   * Calcula el total consumido en profesionales
   */
  const calcularTotalProfesionales = () => {
    let total = 0;

    // Sumar profesionales agregados individualmente
    profesionalesAgregados.forEach(prof => {
      // Usar importeCalculado si existe, sino calcular
      if (prof.importeCalculado) {
        total += Number(prof.importeCalculado);
      } else {
        if (prof.importeXHora && Number(prof.cantidadHoras || 0) > 0) {
          total += Number(prof.importeXHora) * Number(prof.cantidadHoras);
        }
        if (prof.importeXDia && Number(prof.cantidadDias || 0) > 0) {
          total += Number(prof.importeXDia) * Number(prof.cantidadDias);
        }
        if (prof.importeXSemana && Number(prof.cantidadSemanas || 0) > 0) {
          total += Number(prof.importeXSemana) * Number(prof.cantidadSemanas);
        }
        if (prof.importeXMes && Number(prof.cantidadMeses || 0) > 0) {
          total += Number(prof.importeXMes) * Number(prof.cantidadMeses);
        }
        if (prof.importeXObra) {
          total += Number(prof.importeXObra);
        }
      }
    });

    // NUEVO: Sumar profesionales de los items de la calculadora
    if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
      itemsCalculadora.forEach(item => {
        // Ignorar gastos generales (se cuentan en otrosCostos)
        const esGastoGeneral = item.esGastoGeneral === true ||
                              (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                               item.tipoProfesional?.toLowerCase().includes('general'));
        if (esGastoGeneral) return;

        // Usar subtotalManoObra si existe (es el total ya calculado de mano de obra)
        if (item.subtotalManoObra !== undefined && item.subtotalManoObra !== null) {
          total += Number(item.subtotalManoObra) || 0;
        } else {
          // Si no existe subtotalManoObra, calcular manualmente
          // Opción 1: Tiene lista de profesionales desglosados
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              if (prof.subtotal !== undefined && prof.subtotal !== null) {
                total += Number(prof.subtotal) || 0;
              } else {
                const cantidad = Number(prof.cantidadJornales) || 0;
                const importe = Number(prof.importeJornal) || 0;
                total += cantidad * importe;
              }
            });
          }

          // Opción 2: Tiene modo "Cantidad Jornales x Importe" (sin desglose)
          if (item.cantidadJornales && item.importeJornal && !item.profesionales?.length) {
            const cantidad = Number(item.cantidadJornales) || 0;
            const importe = Number(item.importeJornal) || 0;
            total += cantidad * importe;
          }
        }
      });
    }

    return total;
  };

  /**
   * Calcula el total consumido en materiales
   */
  const calcularTotalMateriales = () => {
    let total = 0;

    // Sumar materiales agregados individualmente
    materialesAgregados.forEach(mat => {
      // Usar cantidad * precioUnitario
      const cantidad = Number(mat.cantidad || 0);
      const precioUnitario = Number(mat.precioUnitario || 0);
      total += cantidad * precioUnitario;
    });

    // NUEVO: Sumar materiales de los items de la calculadora
    if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
      itemsCalculadora.forEach(item => {
        // Ignorar gastos generales (se cuentan en otrosCostos)
        const esGastoGeneral = item.esGastoGeneral === true ||
                              (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                               item.tipoProfesional?.toLowerCase().includes('general'));
        if (esGastoGeneral) return;

        // Usar subtotalMateriales si existe (es el total ya calculado de materiales)
        if (item.subtotalMateriales !== undefined && item.subtotalMateriales !== null) {
          total += Number(item.subtotalMateriales) || 0;
        } else {
          // Si no existe subtotalMateriales, calcular manualmente
          // Opción 1: Tiene lista de materiales desglosados
          if (item.materialesLista && Array.isArray(item.materialesLista)) {
            item.materialesLista.forEach(mat => {
              if (mat.subtotal !== undefined && mat.subtotal !== null) {
                total += Number(mat.subtotal) || 0;
              } else {
                const cantidad = Number(mat.cantidad) || 0;
                const precioUnitario = Number(mat.precioUnitario) || 0;
                total += cantidad * precioUnitario;
              }
            });
          }

          // Opción 2: Tiene un monto fijo de materiales (sin desglose)
          if (item.materialesTotal && !item.materialesLista?.length) {
            total += Number(item.materialesTotal) || 0;
          }
        }
      });
    }

    return total;
  };

  /**
   * Calcula el total consumido en jornales
   */
  const calcularTotalJornales = () => {
    let total = 0;

    if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
      itemsCalculadora.forEach(item => {
        // Ignorar gastos generales
        const esGastoGeneral = item.esGastoGeneral === true ||
                              (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                               item.tipoProfesional?.toLowerCase().includes('general'));
        if (esGastoGeneral) return;

        // Sumar subtotalJornales si existe (este ya contiene la suma de todos los jornales)
        if (item.subtotalJornales !== undefined && item.subtotalJornales !== null) {
          total += Number(item.subtotalJornales) || 0;
        }
        // Si no existe subtotalJornales, calcular desde el array de jornales
        else if (item.jornales && Array.isArray(item.jornales)) {
          item.jornales.forEach(jornal => {
            if (jornal.subtotal !== undefined && jornal.subtotal !== null) {
              total += Number(jornal.subtotal) || 0;
            } else {
              const cantidad = Number(jornal.cantidadJornales) || 0;
              const importe = Number(jornal.importeJornal) || 0;
              total += cantidad * importe;
            }
          });
        }
      });
    }

    return total;
  };

  /**
   * Calcula el total consumido en otros costos
   */
  const calcularTotalOtrosCostos = () => {
    let total = 0;
    otrosCostosAgregados.forEach(otro => {
      total += Number(otro.importe || otro.monto || otro.costo || 0);
    });
    return total;
  };

  /**
   * Calcula el honorario para una sección específica
   */
  const calcularHonorarioSeccion = (totalSeccion, seccion, configuracion = null) => {
    // Usar la configuración pasada como parámetro, o por defecto honorariosActual
    const configAUsar = configuracion || honorariosActual;
    const config = configAUsar[seccion] || {};

    // 🐛 DEBUG: Log para jornales
    if (seccion === 'jornales') {
      console.log('🔍 calcularHonorarioSeccion - jornales:', {
        totalSeccion,
        config,
        modoAplicacion: config.modoAplicacion,
        activo: config.activo,
        valor: config.valor
      });
    }

    // 🆕 CASO ESPECIAL: Jornales con configuración por rol
    if (seccion === 'jornales' && config.modoAplicacion === 'porRol' && config.porRol) {
      let totalHonorario = 0;

      // Recorrer todos los items y calcular honorario por rol
      if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
        itemsCalculadora.forEach(item => {
          if (item.jornales && Array.isArray(item.jornales)) {
            item.jornales.forEach(jornal => {
              const rol = jornal.rol;
              const configRol = config.porRol[rol];

              if (configRol && configRol.valor && Number(configRol.valor) > 0) {
                const subtotalJornal = Number(jornal.subtotal) || 0;

                if (configRol.tipo === 'porcentaje') {
                  totalHonorario += (subtotalJornal * Number(configRol.valor)) / 100;
                } else {
                  // Para tipo fijo, aplicar proporcionalmente según el subtotal
                  totalHonorario += Number(configRol.valor);
                }
              }
            });
          }
        });
      }

      return totalHonorario;
    }

    // Lógica original para otras secciones o jornales en modo "todos"
    if (!config.activo || !config.valor || Number(config.valor) <= 0) {
      if (seccion === 'jornales') {
        console.log('❌ Retornando 0 porque:', {
          activo: config.activo,
          valor: config.valor,
          valorNumerico: Number(config.valor)
        });
      }
      return 0;
    }

    if (config.tipo === 'porcentaje') {
      const resultado = (totalSeccion * Number(config.valor)) / 100;
      if (seccion === 'jornales') {
        console.log('✅ Calculando porcentaje:', {
          totalSeccion,
          valor: config.valor,
          resultado
        });
      }
      return resultado;
    } else {
      return Number(config.valor);
    }
  };

  /**
   * Calcula todos los totales y honorarios/mayores costos
   * @param {string|null} rubroEspecifico - ID del rubro específico para calcular solo sus datos
   * @param {object|null} configuracion - Objeto de configuración (honorarios o mayores costos)
   */
  const calcularResumenHonorarios = (rubroEspecifico = null, configuracion = null) => {
    // Usar la configuración pasada o por defecto honorariosActual
    const configAUsar = configuracion || honorariosActual;

    // Si se especifica un rubro, usar solo sus datos
    if (rubroEspecifico && itemsCalculadora && Array.isArray(itemsCalculadora)) {
      const rubroItem = itemsCalculadora.find(item => (item.id || itemsCalculadora.indexOf(item)) == rubroEspecifico);

      if (rubroItem) {
        // Usar solo los datos del rubro específico
        const totalProfRubro = parseFloat(rubroItem.subtotalManoObra) || 0;
        const totalMatRubro = parseFloat(rubroItem.subtotalMateriales) || 0;
        const totalGastosRubro = parseFloat(rubroItem.subtotalGastosGenerales) || 0;

        // Calcular honorarios/mayores costos para cada sección del rubro usando la configuración correcta
        const honorarioProf = calcularHonorarioSeccion(totalProfRubro, 'profesionales', configAUsar);
        const honorarioMat = calcularHonorarioSeccion(totalMatRubro, 'materiales', configAUsar);
        const honorarioGastos = calcularHonorarioSeccion(totalGastosRubro, 'otrosCostos', configAUsar);

        // 🔥 CALCULAR HONORARIOS DEL RUBRO usando configuración principal de honorarios
        let totalHonorariosRubro = 0;
        if (honorarios) {
          if (honorarios.profesionales?.activo && honorarios.profesionales?.valor) {
            const valor = Number(honorarios.profesionales.valor);
            if (honorarios.profesionales.tipo === 'porcentaje') {
              totalHonorariosRubro += (totalProfRubro * valor) / 100;
            }
          }

          if (honorarios.materiales?.activo && honorarios.materiales?.valor) {
            const valor = Number(honorarios.materiales.valor);
            if (honorarios.materiales.tipo === 'porcentaje') {
              totalHonorariosRubro += (totalMatRubro * valor) / 100;
            }
          }

          if (honorarios.otrosCostos?.activo && honorarios.otrosCostos?.valor) {
            const valor = Number(honorarios.otrosCostos.valor);
            if (honorarios.otrosCostos.tipo === 'porcentaje') {
              totalHonorariosRubro += (totalGastosRubro * valor) / 100;
            }
          }
        }

        // Aplicar mayores costos sobre los honorarios del rubro
        const mayorCostoSobreHonorarios = calcularHonorarioSeccion(totalHonorariosRubro, 'honorarios', configAUsar);

        const totalSinHonorarios = totalProfRubro + totalMatRubro + totalGastosRubro;
        const totalHonorarios = honorarioProf + honorarioMat + honorarioGastos + mayorCostoSobreHonorarios;
        const totalConHonorarios = totalSinHonorarios + totalHonorarios;

        return {
          profesionales: { base: totalProfRubro, honorario: honorarioProf, total: totalProfRubro + honorarioProf },
          materiales: { base: totalMatRubro, honorario: honorarioMat, total: totalMatRubro + honorarioMat },
          otrosCostos: { base: totalGastosRubro, honorario: honorarioGastos, total: totalGastosRubro + honorarioGastos },
          configuracionPresupuesto: { base: 0, honorario: 0, total: 0 }, // No aplica para rubro específico
          gastosGenerales: { base: totalGastosRubro, honorario: honorarioGastos, total: totalGastosRubro + honorarioGastos },
          honorarios: { base: totalHonorariosRubro, honorario: mayorCostoSobreHonorarios, total: totalHonorariosRubro + mayorCostoSobreHonorarios }, // 🔥 Honorarios del rubro específico
          totales: {
            base: totalSinHonorarios,
            honorarios: totalHonorarios,
            final: totalConHonorarios
          },
          rubroEspecifico: rubroItem.tipoProfesional // Identificar que es cálculo de rubro específico
        };
      }
    }

    // Lógica original para cálculo completo del presupuesto
    const totalJornales = calcularTotalJornales();
    const totalProf = calcularTotalProfesionales();
    const totalMat = calcularTotalMateriales();
    const totalOtros = calcularTotalOtrosCostos();

    let totalCalculadoraSinDesglozar = 0;
    let totalGastosGenerales = 0;

    if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
      itemsCalculadora.forEach((item, idx) => {
        const esGastoGeneral = item.esGastoGeneral === true ||
                              (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                               item.tipoProfesional?.toLowerCase().includes('general'));

        if (esGastoGeneral) {
          totalGastosGenerales += parseFloat(item.total) || 0;
          return;
        }

        // 🆕 SUMAR GASTOS GENERALES de CADA item (array gastosGenerales[])
        if (item.subtotalGastosGenerales && item.subtotalGastosGenerales > 0) {
          totalGastosGenerales += parseFloat(item.subtotalGastosGenerales) || 0;
        }

        // ✅ CORREGIDO: Detectar si tiene desglose (excluyendo jornales que ya están en totalJornales)
        const tieneJornales = (item.jornales?.length > 0) || (item.subtotalJornales && item.subtotalJornales > 0);
        const tieneProfesionales = (item.profesionales?.length > 0) || (item.subtotalManoObra && item.subtotalManoObra > 0);
        const tieneMateriales = (item.materialesLista?.length > 0) ||
                               (item.materialesTotal && item.materialesTotal > 0) ||
                               (item.subtotalMateriales && item.subtotalMateriales > 0);

        // Si tiene Total Manual, sumarlo directamente (ya que no tiene desglose)
        if (item.totalManual && item.totalManual > 0) {
          totalCalculadoraSinDesglozar += parseFloat(item.totalManual) || 0;
        }
        // Si no tiene desglose de profesionales/materiales/jornales, pero tiene total (y NO es total manual)
        else if (!tieneProfesionales && !tieneMateriales && !tieneJornales && item.total) {
          totalCalculadoraSinDesglozar += parseFloat(item.total) || 0;
        }
        // Si SOLO tiene jornales (sin profesionales ni materiales), NO sumar al calculadora
        // porque ya se sumó en totalJornales
      });
    }

    const honorarioJornales = calcularHonorarioSeccion(totalJornales, 'jornales', configAUsar);
    const honorarioProf = calcularHonorarioSeccion(totalProf, 'profesionales', configAUsar);
    const honorarioMat = calcularHonorarioSeccion(totalMat, 'materiales', configAUsar);
    const honorarioOtros = calcularHonorarioSeccion(totalOtros, 'otrosCostos', configAUsar);
    const honorarioCalculadora = calcularHonorarioSeccion(totalCalculadoraSinDesglozar, 'configuracionPresupuesto', configAUsar);
    const honorarioGastosGenerales = calcularHonorarioSeccion(totalGastosGenerales, 'otrosCostos', configAUsar); // 🆕 Usar configuración de "otrosCostos"

    // 🆕 NUEVA SECCIÓN: Calcular honorarios sobre honorarios (para mayores costos)
    let totalHonorariosBase = 0;
    let honorarioSobreHonorarios = 0;

    // 🔥 SIEMPRE calcular el total de honorarios usando la configuración PRINCIPAL de honorarios (no mayores costos)
    if (honorarios) {
      // Calcular solo los honorarios usando configuración principal (sin mayores costos)
      const honorariosJornalesPrincipal = calcularHonorarioSeccion(totalJornales, 'jornales', honorarios);
      const honorariosProfPrincipal = calcularHonorarioSeccion(totalProf, 'profesionales', honorarios);
      const honorariosMatPrincipal = calcularHonorarioSeccion(totalMat, 'materiales', honorarios);
      const honorariosOtrosPrincipal = calcularHonorarioSeccion(totalOtros, 'otrosCostos', honorarios);
      const honorariosCalculadoraPrincipal = calcularHonorarioSeccion(totalCalculadoraSinDesglozar, 'configuracionPresupuesto', honorarios);
      const honorariosGastosGeneralesPrincipal = calcularHonorarioSeccion(totalGastosGenerales, 'otrosCostos', honorarios);

      totalHonorariosBase = honorariosJornalesPrincipal + honorariosProfPrincipal + honorariosMatPrincipal + honorariosOtrosPrincipal +
                           honorariosCalculadoraPrincipal + honorariosGastosGeneralesPrincipal;

      // Si estamos calculando mayores costos, aplicar % sobre honorarios
      if (configuracion) {
        honorarioSobreHonorarios = calcularHonorarioSeccion(totalHonorariosBase, 'honorarios', configAUsar);
      }
    }

    const totalSinHonorarios = totalJornales + totalProf + totalMat + totalOtros + totalCalculadoraSinDesglozar + totalGastosGenerales;
    const totalHonorarios = honorarioJornales + honorarioProf + honorarioMat + honorarioOtros + honorarioCalculadora + honorarioGastosGenerales + honorarioSobreHonorarios;
    const totalConHonorarios = totalSinHonorarios + totalHonorarios;

    // 🔥 Detectar si estamos calculando MAYORES COSTOS (configuracion pasada como parámetro)
    const esMayoresCostos = configuracion !== null && configuracion !== honorariosActual;

    // Para mayores costos:
    // - Las bases de cada categoría deben INCLUIR sus honorarios ya aplicados
    // - Los mayores costos se aplican sobre (base + honorarios) de cada categoría
    // - NO se debe mostrar una base de "Honorarios" separada, ya están incluidos
    const baseParaResumen = esMayoresCostos
      ? (totalJornales + honorarioJornales + totalProf + honorarioProf + totalMat + honorarioMat +
         totalGastosGenerales + honorarioGastosGenerales + totalCalculadoraSinDesglozar + honorarioCalculadora)
      : totalSinHonorarios;

    return {
      // Para mayores costos: base incluye honorarios para cálculo, baseOriginal es solo el total sin honorarios
      jornales: {
        baseOriginal: totalJornales,
        base: esMayoresCostos ? (totalJornales + (honorarios?.jornales ? calcularHonorarioSeccion(totalJornales, 'jornales', honorarios) : 0)) : totalJornales,
        honorario: honorarioJornales,
        total: totalJornales + honorarioJornales
      },
      profesionales: {
        baseOriginal: totalProf,
        base: esMayoresCostos ? (totalProf + (honorarios?.profesionales ? calcularHonorarioSeccion(totalProf, 'profesionales', honorarios) : 0)) : totalProf,
        honorario: honorarioProf,
        total: totalProf + honorarioProf
      },
      materiales: {
        baseOriginal: totalMat,
        base: esMayoresCostos ? (totalMat + (honorarios?.materiales ? calcularHonorarioSeccion(totalMat, 'materiales', honorarios) : 0)) : totalMat,
        honorario: honorarioMat,
        total: totalMat + honorarioMat
      },
      otrosCostos: {
        baseOriginal: totalOtros,
        base: esMayoresCostos ? (totalOtros + (honorarios?.otrosCostos ? calcularHonorarioSeccion(totalOtros, 'otrosCostos', honorarios) : 0)) : totalOtros,
        honorario: honorarioOtros,
        total: totalOtros + honorarioOtros
      },
      configuracionPresupuesto: {
        baseOriginal: totalCalculadoraSinDesglozar,
        base: esMayoresCostos ? (totalCalculadoraSinDesglozar + (honorarios?.configuracionPresupuesto ? calcularHonorarioSeccion(totalCalculadoraSinDesglozar, 'configuracionPresupuesto', honorarios) : 0)) : totalCalculadoraSinDesglozar,
        honorario: honorarioCalculadora,
        total: totalCalculadoraSinDesglozar + honorarioCalculadora
      },
      gastosGenerales: {
        baseOriginal: totalGastosGenerales,
        base: esMayoresCostos ? (totalGastosGenerales + (honorarios?.otrosCostos ? calcularHonorarioSeccion(totalGastosGenerales, 'otrosCostos', honorarios) : 0)) : totalGastosGenerales,
        honorario: honorarioGastosGenerales,
        total: totalGastosGenerales + honorarioGastosGenerales
      },
      // Honorarios: en mayores costos mostrar la base de honorarios para poder aplicar mayores costos
      honorarios: {
        base: totalHonorariosBase,
        honorario: honorarioSobreHonorarios,
        total: totalHonorariosBase + honorarioSobreHonorarios
      },
      totales: {
        base: baseParaResumen,
        honorarios: totalHonorarios,
        final: baseParaResumen + totalHonorarios
      }
    };
  };

  /**
   * Calcula el total de descuentos sobre honorarios usando sub-tipos individuales.
   * Si hay algún sub-tipo configurado, usa esa lógica desglosada.
   * Si no, hace fallback al honorario "total" (backward compat).
   */
  const calcularDescuentoHonorarios = (resumen, cfg) => {
    // otrosCostos y gastosGenerales son sinónimos — usar el que tenga valor configurado,
    // nunca ambos al mismo tiempo para evitar doble conteo.
    const baseOtros = resumen.otrosCostos?.honorario || resumen.gastosGenerales?.honorario || 0;
    const usaGastosGenerales = Number(cfg.honorariosGastosGenerales?.valor || 0) > 0;

    const subtipos = [
      { key: 'honorariosJornales', base: resumen.jornales?.honorario || 0 },
      { key: 'honorariosProfesionales', base: resumen.profesionales?.honorario || 0 },
      { key: 'honorariosMateriales', base: resumen.materiales?.honorario || 0 },
      { key: 'honorariosOtros', base: usaGastosGenerales ? 0 : baseOtros },
      { key: 'honorariosGastosGenerales', base: baseOtros },
      { key: 'honorariosConfiguracion', base: resumen.configuracionPresupuesto?.honorario || 0 }
    ];

    const haySubtipoCfg = subtipos.some(({ key }) => Number(cfg[key]?.valor || 0) > 0);

    if (haySubtipoCfg) {
      return subtipos.reduce((acc, { key, base }) => {
        const c = cfg[key];
        if (c?.activo === false || !(base > 0)) return acc;
        const valor = Number(c?.valor || 0);
        if (valor <= 0) return acc;
        return acc + (c.tipo === 'porcentaje' ? (base * valor) / 100 : valor);
      }, 0);
    }

    // Fallback legacy
    if (cfg.honorarios?.activo !== false) {
      const baseHon = resumen.honorarios?.base || 0;
      const valor = Number(cfg.honorarios?.valor || 0);
      if (valor > 0) {
        return cfg.honorarios.tipo === 'porcentaje' ? (baseHon * valor) / 100 : valor;
      }
    }
    return 0;
  };

  // ========== FUNCIONES PROFESIONALES ==========
  const selectModoConfigProfesional = (modo) => {
    setNewConfigProfesional(prev => ({
      ...prev,
      modoSeleccionado: modo,
      importeHora: modo === 'hora' ? prev.importeHora : '',
      importeDia: modo === 'dia' ? prev.importeDia : '',
      importeSemana: modo === 'semana' ? prev.importeSemana : '',
      importeMes: modo === 'mes' ? prev.importeMes : '',
      cantidadHoras: modo === 'hora' ? prev.cantidadHoras : '',
      cantidadDias: modo === 'dia' ? prev.cantidadDias : '',
      cantidadSemanas: modo === 'semana' ? prev.cantidadSemanas : '',
      cantidadMeses: modo === 'mes' ? prev.cantidadMeses : ''
    }));
  };

  const acceptConfigProfesional = () => {
    // Si no es configuración general, requiere tipo de profesional
    if (!newConfigProfesional.esGeneral && !newConfigProfesional.tipoProfesional.trim()) {
      alert('Debe ingresar el tipo de profesional o marcar como configuración general');
      return;
    }
    if (!newConfigProfesional.modoSeleccionado) {
      alert('Debe seleccionar un modo de cálculo');
      return;
    }

    const newConfigs = [...configsProfesionales, { ...newConfigProfesional }];
    onConfigsChange({ profesionales: newConfigs, materiales: configsMateriales, otros: configsOtros });

    setNewConfigProfesional({
      tipoProfesional: '',
      importeHora: '',
      importeDia: '',
      importeSemana: '',
      importeMes: '',
      cantidadHoras: '',
      cantidadDias: '',
      cantidadSemanas: '',
      cantidadMeses: '',
      modoSeleccionado: 'hora',  // FORZADO A 'hora' - único modo permitido
      esGeneral: true  // Volver a tildado por defecto
    });
    setShowAddConfigProfesional(false);
  };

  const cancelConfigProfesional = () => {
    setNewConfigProfesional({
      tipoProfesional: '',
      importeHora: '',
      importeDia: '',
      importeSemana: '',
      importeMes: '',
      cantidadHoras: '',
      cantidadDias: '',
      cantidadSemanas: '',
      cantidadMeses: '',
      modoSeleccionado: 'hora',  // FORZADO A 'hora' - único modo permitido
      esGeneral: true,  // Volver a tildado por defecto
      metrosCuadrados: '',  // Limpiar metros cuadrados
      importePorMetroCuadrado: ''  // Limpiar importe por m²
    });
    setShowAddConfigProfesional(false);
  };

  const removeConfigProfesional = (idx) => {
    const newConfigs = configsProfesionales.filter((_, i) => i !== idx);
    onConfigsChange({ profesionales: newConfigs, materiales: configsMateriales, otros: configsOtros });
  };

  // ========== FUNCIÓN PARA CONVERTIR ENTRE ESPECÍFICA Y GENERAL ==========

  const toggleConfiguracionGeneral = (idx) => {
    const config = configsProfesionales[idx];
    const nuevoEstado = !config.esGeneral;

    // Si está cambiando de GENERAL a ESPECÍFICA, pedir el tipo de profesional
    if (!nuevoEstado && config.esGeneral) {
      // Obtener profesionales que actualmente están consumiendo de esta configuración general
      const profesionalesQueConsumen = profesionalesAgregados.filter(prof => {
        // Solo incluir profesionales que NO tienen configuración específica
        const tieneConfigEspecifica = configsProfesionales.some(
          c => !c.esGeneral &&
               c.tipoProfesional?.toLowerCase() === prof.tipoProfesional?.toLowerCase()
        );
        return !tieneConfigEspecifica && prof.tipoProfesional?.trim();
      });

      // Obtener tipos únicos
      const tiposUnicos = [...new Set(profesionalesQueConsumen.map(p => p.tipoProfesional?.trim()))].filter(Boolean);

      let tipoProfesional;

      if (tiposUnicos.length === 0) {
        // No hay profesionales consumiendo, pedir ingreso manual
        tipoProfesional = prompt(
          'Ingrese el tipo de profesional para esta configuración específica:',
          'Ej: Albañil, Electricista, Plomero...'
        );
      } else if (tiposUnicos.length === 1) {
        // Solo hay un tipo, tomarlo automáticamente
        tipoProfesional = tiposUnicos[0];
        const confirmar = window.confirm(
          `Se detectó que esta configuración general está siendo consumida por:\n\n` +
          `📋 Tipo: "${tipoProfesional}"\n\n` +
          `¿Convertir a configuración específica de "${tipoProfesional}"?`
        );
        if (!confirmar) return;
      } else {
        // Múltiples tipos, mostrar modal de selección múltiple
        setShowSeleccionMultiple({
          configIdx: idx,
          tiposDisponibles: tiposUnicos,
          tiposSeleccionados: []
        });
        return;
      }

      if (!tipoProfesional || !tipoProfesional.trim()) {
        alert('Debe ingresar un tipo de profesional para crear una configuración específica');
        return;
      }

      const configsActualizadas = configsProfesionales.map((c, i) => {
        if (i === idx) {
          return {
            ...c,
            esGeneral: false,
            tipoProfesional: tipoProfesional.trim()
          };
        }
        return c;
      });

      onConfigsChange({ profesionales: configsActualizadas, materiales: configsMateriales, otros: configsOtros });

      // Mensaje de confirmación
      setTimeout(() => {
        alert(`✅ Configuración convertida a ESPECÍFICA de "${tipoProfesional.trim()}"\n\nLos totales se han actualizado automáticamente.`);
      }, 100);
      return;
    }

    // Si está cambiando de ESPECÍFICA a GENERAL
    if (nuevoEstado && !config.esGeneral) {
      const tipoActual = `específica de "${config.tipoProfesional}"`;
      const tipoProfesionalAnterior = config.tipoProfesional;

      const confirmar = window.confirm(
        `¿Convertir esta configuración ${tipoActual} a GENERAL?\n\n` +
        `⚠️ La configuración general solo consumirá profesionales que NO tengan configuración específica.\n\n` +
        `Los profesionales de tipo "${tipoProfesionalAnterior}" dejarán de consumir de esta configuración si tienen otra config específica.\n\n` +
        `Los totales se actualizarán automáticamente.`
      );

      if (!confirmar) return;

      const configsActualizadas = configsProfesionales.map((c, i) => {
        if (i === idx) {
          return {
            ...c,
            esGeneral: true,
            tipoProfesional: '' // Limpiar el tipo al hacerla general
          };
        }
        return c;
      });

      onConfigsChange({ profesionales: configsActualizadas, materiales: configsMateriales, otros: configsOtros });

      // Mensaje de confirmación
      setTimeout(() => {
        alert(`✅ Configuración convertida a GENERAL\n\nAhora solo consumirá profesionales sin configuración específica.\nLos totales se han actualizado.`);
      }, 100);
    }
  };

  // ========== FUNCIONES SELECCIÓN MÚLTIPLE PARA CREAR CONFIGS ESPECÍFICAS ==========

  const toggleSeleccionTipo = (tipo) => {
    if (!showSeleccionMultiple) return;

    const yaSeleccionado = showSeleccionMultiple.tiposSeleccionados.includes(tipo);
    const nuevosSeleccionados = yaSeleccionado
      ? showSeleccionMultiple.tiposSeleccionados.filter(t => t !== tipo)
      : [...showSeleccionMultiple.tiposSeleccionados, tipo];

    setShowSeleccionMultiple({
      ...showSeleccionMultiple,
      tiposSeleccionados: nuevosSeleccionados
    });
  };

  const aplicarSeleccionMultiple = () => {
    if (!showSeleccionMultiple || showSeleccionMultiple.tiposSeleccionados.length === 0) {
      alert('Debe seleccionar al menos un tipo de profesional');
      return;
    }

    const configOriginal = configsProfesionales[showSeleccionMultiple.configIdx];

    // Eliminar la configuración general original
    let configsActualizadas = configsProfesionales.filter((_, i) => i !== showSeleccionMultiple.configIdx);

    // Crear una configuración específica por cada tipo seleccionado
    showSeleccionMultiple.tiposSeleccionados.forEach(tipo => {
      const nuevaConfig = {
        ...configOriginal,
        esGeneral: false,
        tipoProfesional: tipo
      };
      configsActualizadas.push(nuevaConfig);
    });

    onConfigsChange({ profesionales: configsActualizadas, materiales: configsMateriales, otros: configsOtros });

    const cantidadCreadas = showSeleccionMultiple.tiposSeleccionados.length;
    setTimeout(() => {
      alert(
        `✅ Se crearon ${cantidadCreadas} configuraciones específicas:\n\n` +
        showSeleccionMultiple.tiposSeleccionados.map(t => `• ${t}`).join('\n') +
        `\n\nCada una tiene su propia barra de progreso.`
      );
    }, 100);

    setShowSeleccionMultiple(null);
  };

  const cancelarSeleccionMultiple = () => {
    setShowSeleccionMultiple(null);
  };

  // ========== FUNCIONES AGREGAR DISPONIBLE A CONFIGURACIÓN EXISTENTE ==========

  const iniciarAgregarDisponible = (idx) => {
    const config = configsProfesionales[idx];
    setEditingConfigProfesional({
      index: idx,
      cantidadAdicional: '',
      importeAdicional: config.modoSeleccionado === 'hora' ? config.importeHora :
                       config.modoSeleccionado === 'dia' ? config.importeDia :
                       config.modoSeleccionado === 'semana' ? config.importeSemana :
                       config.importeMes
    });
  };

  const cancelarAgregarDisponible = () => {
    setEditingConfigProfesional(null);
  };

  const aplicarDisponibleAdicional = () => {
    if (!editingConfigProfesional) return;

    const { index, cantidadAdicional, importeAdicional } = editingConfigProfesional;

    if (!cantidadAdicional || Number(cantidadAdicional) <= 0) {
      alert('Debe ingresar una cantidad válida');
      return;
    }
    if (!importeAdicional || Number(importeAdicional) <= 0) {
      alert('Debe ingresar un importe válido');
      return;
    }

    const configsActualizadas = configsProfesionales.map((c, i) => {
      if (i === index) {
        const modo = c.modoSeleccionado;
        const cantidadActual =
          modo === 'hora' ? Number(c.cantidadHoras || 0) :
          modo === 'dia' ? Number(c.cantidadDias || 0) :
          modo === 'semana' ? Number(c.cantidadSemanas || 0) :
          Number(c.cantidadMeses || 0);

        const nuevaCantidad = cantidadActual + Number(cantidadAdicional);

        // Construir el objeto actualizado
        const propNombre =
          modo === 'hora' ? 'cantidadHoras' :
          modo === 'dia' ? 'cantidadDias' :
          modo === 'semana' ? 'cantidadSemanas' : 'cantidadMeses';

        const propImporte =
          modo === 'hora' ? 'importeHora' :
          modo === 'dia' ? 'importeDia' :
          modo === 'semana' ? 'importeSemana' : 'importeMes';

        return {
          ...c,
          [propNombre]: nuevaCantidad,
          [propImporte]: importeAdicional  // Actualizar el importe también
        };
      }
      return c;
    });

    onConfigsChange({ profesionales: configsActualizadas, materiales: configsMateriales, otros: configsOtros });
    setEditingConfigProfesional(null);
  };

  // ========== FUNCIONES MATERIALES ==========
  const acceptConfigMaterial = () => {
    // Si no es configuración general, requiere tipo de material
    if (!newConfigMaterial.esGeneral && !newConfigMaterial.tipoMaterial.trim()) {
      alert('Debe ingresar el tipo de material o marcar como configuración general');
      return;
    }
    if (!newConfigMaterial.presupuestoTotal || Number(newConfigMaterial.presupuestoTotal) <= 0) {
      alert('Debe ingresar un presupuesto total válido');
      return;
    }

    const newConfigs = [...configsMateriales, { ...newConfigMaterial }];
    onConfigsChange({ profesionales: configsProfesionales, materiales: newConfigs, otros: configsOtros });

    setNewConfigMaterial({
      tipoMaterial: '',
      presupuestoTotal: '',
      esGeneral: true  // Volver a tildado por defecto
    });
    setShowAddConfigMaterial(false);
  };

  const cancelConfigMaterial = () => {
    setNewConfigMaterial({
      tipoMaterial: '',
      presupuestoTotal: '',
      esGeneral: true,
      metrosCuadrados: '',
      importePorMetroCuadrado: ''
    });
    setShowAddConfigMaterial(false);
  };

  const removeConfigMaterial = (idx) => {
    const newConfigs = configsMateriales.filter((_, i) => i !== idx);
    onConfigsChange({ profesionales: configsProfesionales, materiales: newConfigs, otros: configsOtros });
  };

  const toggleConfiguracionGeneralMaterial = (idx) => {
    const config = configsMateriales[idx];
    const nuevoEstado = !config.esGeneral;

    // Si está cambiando de GENERAL a ESPECÍFICA
    if (!nuevoEstado && config.esGeneral) {
      // Obtener materiales que actualmente están consumiendo de esta configuración general
      const materialesQueConsumen = materialesAgregados.filter(mat => {
        const tieneConfigEspecifica = configsMateriales.some(
          c => !c.esGeneral &&
               c.tipoMaterial?.toLowerCase() === mat.tipoMaterial?.toLowerCase()
        );
        return !tieneConfigEspecifica && mat.tipoMaterial?.trim();
      });

      const tiposUnicos = [...new Set(materialesQueConsumen.map(m => m.tipoMaterial?.trim()))].filter(Boolean);

      let tipoMaterial;

      if (tiposUnicos.length === 0) {
        tipoMaterial = prompt(
          'Ingrese el tipo de material para esta configuración específica:',
          'Ej: Cemento, Ladrillos, Pintura...'
        );
      } else if (tiposUnicos.length === 1) {
        tipoMaterial = tiposUnicos[0];
        const confirmar = window.confirm(
          `Se detectó que esta configuración general está siendo consumida por:\n\n` +
          `📋 Tipo: "${tipoMaterial}"\n\n` +
          `¿Convertir a configuración específica de "${tipoMaterial}"?`
        );
        if (!confirmar) return;
      } else {
        // Múltiples tipos disponibles
        setShowSeleccionMultipleMaterial({
          configIdx: idx,
          tiposDisponibles: tiposUnicos,
          tiposSeleccionados: []
        });
        return;
      }

      if (!tipoMaterial || !tipoMaterial.trim()) {
        alert('Debe ingresar un tipo de material para crear una configuración específica');
        return;
      }

      const configsActualizadas = configsMateriales.map((c, i) => {
        if (i === idx) {
          return { ...c, esGeneral: false, tipoMaterial: tipoMaterial.trim() };
        }
        return c;
      });

      onConfigsChange({ profesionales: configsProfesionales, materiales: configsActualizadas, otros: configsOtros });

      setTimeout(() => {
        alert(`✅ Configuración convertida a ESPECÍFICA de "${tipoMaterial.trim()}"\n\nLos totales se han actualizado automáticamente.`);
      }, 100);
      return;
    }

    // Si está cambiando de ESPECÍFICA a GENERAL
    if (nuevoEstado && !config.esGeneral) {
      const confirmar = window.confirm(
        `¿Convertir esta configuración específica de "${config.tipoMaterial}" a GENERAL?\n\n` +
        `⚠️ La configuración general solo consumirá materiales que NO tengan configuración específica.\n\n` +
        `Los totales se actualizarán automáticamente.`
      );

      if (!confirmar) return;

      const configsActualizadas = configsMateriales.map((c, i) => {
        if (i === idx) {
          return { ...c, esGeneral: true, tipoMaterial: '' };
        }
        return c;
      });

      onConfigsChange({ profesionales: configsProfesionales, materiales: configsActualizadas, otros: configsOtros });

      setTimeout(() => {
        alert(`✅ Configuración convertida a GENERAL\n\nAhora solo consumirá materiales sin configuración específica.\nLos totales se han actualizado.`);
      }, 100);
    }
  };

  const iniciarAgregarDisponibleMaterial = (idx) => {
    setEditingConfigMaterial({ index: idx, presupuestoAdicional: '' });
  };

  const aplicarDisponibleAdicionalMaterial = () => {
    if (!editingConfigMaterial) return;

    const adicional = Number(editingConfigMaterial.presupuestoAdicional || 0);
    if (adicional <= 0) {
      alert('Debe ingresar un monto adicional válido');
      return;
    }

    const configsActualizadas = configsMateriales.map((c, i) => {
      if (i === editingConfigMaterial.index) {
        const presupuestoActual = Number(c.presupuestoTotal || 0);
        return { ...c, presupuestoTotal: presupuestoActual + adicional };
      }
      return c;
    });

    onConfigsChange({ profesionales: configsProfesionales, materiales: configsActualizadas, otros: configsOtros });
    setEditingConfigMaterial(null);
  };

  // ========== FUNCIONES OTROS COSTOS ==========
  const acceptConfigOtro = () => {
    // Si no es configuración general, requiere descripción
    if (!newConfigOtro.esGeneral && !newConfigOtro.descripcion.trim()) {
      alert('Debe ingresar una descripción o marcar como configuración general');
      return;
    }
    if (!newConfigOtro.presupuestoTotal || Number(newConfigOtro.presupuestoTotal) <= 0) {
      alert('Debe ingresar un presupuesto total válido');
      return;
    }

    const newConfigs = [...configsOtros, { ...newConfigOtro }];
    onConfigsChange({ profesionales: configsProfesionales, materiales: configsMateriales, otros: newConfigs });

    setNewConfigOtro({
      descripcion: '',
      rubro: '',  // Limpiar rubro
      presupuestoTotal: '',
      esGeneral: true  // Volver a tildado por defecto
    });
    setShowAddConfigOtro(false);
  };

  const cancelConfigOtro = () => {
    setNewConfigOtro({
      descripcion: '',
      rubro: '',  // Limpiar rubro
      presupuestoTotal: '',
      esGeneral: true,
      metrosCuadrados: '',
      importePorMetroCuadrado: ''
    });
    setShowAddConfigOtro(false);
  };

  const removeConfigOtro = (idx) => {
    const newConfigs = configsOtros.filter((_, i) => i !== idx);
    onConfigsChange({ profesionales: configsProfesionales, materiales: configsMateriales, otros: newConfigs });
  };

  const toggleConfiguracionGeneralOtro = (idx) => {
    const config = configsOtros[idx];
    const nuevoEstado = !config.esGeneral;

    // Si está cambiando de GENERAL a ESPECÍFICA
    if (!nuevoEstado && config.esGeneral) {
      // Obtener costos que actualmente están consumiendo de esta configuración general
      const costosQueConsumen = otrosCostosAgregados.filter(otro => {
        const tieneConfigEspecifica = configsOtros.some(
          c => !c.esGeneral &&
               otro.descripcion?.toLowerCase().includes(c.descripcion?.toLowerCase())
        );
        return !tieneConfigEspecifica && otro.descripcion?.trim();
      });

      const descripciones = [...new Set(costosQueConsumen.map(o => o.descripcion?.trim()))].filter(Boolean);

      let descripcion;

      if (descripciones.length === 0) {
        descripcion = prompt(
          'Ingrese la descripción para esta configuración específica:',
          'Ej: Transporte, Herramientas, Permisos...'
        );
      } else if (descripciones.length === 1) {
        descripcion = descripciones[0];
        const confirmar = window.confirm(
          `Se detectó que esta configuración general está siendo consumida por:\n\n` +
          `📋 Descripción: "${descripcion}"\n\n` +
          `¿Convertir a configuración específica de "${descripcion}"?`
        );
        if (!confirmar) return;
      } else {
        // Múltiples descripciones disponibles
        setShowSeleccionMultipleOtro({
          configIdx: idx,
          tiposDisponibles: descripciones,
          tiposSeleccionados: []
        });
        return;
      }

      if (!descripcion || !descripcion.trim()) {
        alert('Debe ingresar una descripción para crear una configuración específica');
        return;
      }

      const configsActualizadas = configsOtros.map((c, i) => {
        if (i === idx) {
          return { ...c, esGeneral: false, descripcion: descripcion.trim() };
        }
        return c;
      });

      onConfigsChange({ profesionales: configsProfesionales, materiales: configsMateriales, otros: configsActualizadas });

      setTimeout(() => {
        alert(`✅ Configuración convertida a ESPECÍFICA de "${descripcion.trim()}"\n\nLos totales se han actualizado automáticamente.`);
      }, 100);
      return;
    }

    // Si está cambiando de ESPECÍFICA a GENERAL
    if (nuevoEstado && !config.esGeneral) {
      const confirmar = window.confirm(
        `¿Convertir esta configuración específica de "${config.descripcion}" a GENERAL?\n\n` +
        `⚠️ La configuración general solo consumirá costos que NO tengan configuración específica.\n\n` +
        `Los totales se actualizarán automáticamente.`
      );

      if (!confirmar) return;

      const configsActualizadas = configsOtros.map((c, i) => {
        if (i === idx) {
          return { ...c, esGeneral: true, descripcion: '' };
        }
        return c;
      });

      onConfigsChange({ profesionales: configsProfesionales, materiales: configsMateriales, otros: configsActualizadas });

      setTimeout(() => {
        alert(`✅ Configuración convertida a GENERAL\n\nAhora solo consumirá costos sin configuración específica.\nLos totales se han actualizado.`);
      }, 100);
    }
  };

  const iniciarAgregarDisponibleOtro = (idx) => {
    setEditingConfigOtro({ index: idx, presupuestoAdicional: '' });
  };

  const aplicarDisponibleAdicionalOtro = () => {
    if (!editingConfigOtro) return;

    const adicional = Number(editingConfigOtro.presupuestoAdicional || 0);
    if (adicional <= 0) {
      alert('Debe ingresar un monto adicional válido');
      return;
    }

    const configsActualizadas = configsOtros.map((c, i) => {
      if (i === editingConfigOtro.index) {
        const presupuestoActual = Number(c.presupuestoTotal || 0);
        return { ...c, presupuestoTotal: presupuestoActual + adicional };
      }
      return c;
    });

    onConfigsChange({ profesionales: configsProfesionales, materiales: configsMateriales, otros: configsActualizadas });
    setEditingConfigOtro(null);
  };

  // Calcular totales para el resumen
  const totalConfiguraciones = configsProfesionales.length + configsMateriales.length + configsOtros.length;

  // Calcular total configurado (presupuesto inicial)
  const totalConfigurado =
    configsProfesionales.reduce((sum, c) => {
      const importe = c.modoSeleccionado === 'hora' ? Number(c.importeHora || 0) :
                      c.modoSeleccionado === 'dia' ? Number(c.importeDia || 0) :
                      c.modoSeleccionado === 'semana' ? Number(c.importeSemana || 0) :
                      Number(c.importeMes || 0);
      const cantidad = c.modoSeleccionado === 'hora' ? Number(c.cantidadHoras || 0) :
                      c.modoSeleccionado === 'dia' ? Number(c.cantidadDias || 0) :
                      c.modoSeleccionado === 'semana' ? Number(c.cantidadSemanas || 0) :
                      Number(c.cantidadMeses || 0);
      return sum + (importe * cantidad);
    }, 0) +
    configsMateriales.reduce((sum, c) => sum + Number(c.presupuestoTotal || 0), 0) +
    configsOtros.reduce((sum, c) => sum + Number(c.presupuestoTotal || 0), 0);

  // Calcular total consumido
  const totalConsumido =
    profesionalesAgregados.reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0) +
    materialesAgregados.reduce((sum, m) => sum + (Number(m.importeTotal) || 0), 0) +
    otrosCostosAgregados.reduce((sum, o) => sum + (Number(o.importeTotal) || 0), 0);

  // Calcular disponible restante
  const totalDisponible = totalConfigurado - totalConsumido;

  try {
  return (
    <div className="border rounded p-3" style={{backgroundColor: '#f8f9fa'}}>
      {/* ========== SECCIÓN DE PRESUPUESTOS ========== */}
      {(mostrarSolo === 'ambos' || mostrarSolo === 'presupuestos') && (
        <>
          <p className="text-muted small mb-3">
            Defina los presupuestos disponibles para profesionales, materiales y otros costos. Puede agregar múltiples configuraciones de cada tipo.
          </p>

      {/* Botones para agregar configuraciones */}
      {!soloLectura && (
        <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => {
              setShowAddConfigProfesional(!showAddConfigProfesional);
            }}
          >
            + Configuración de Profesionales
          </button>
          {configsProfesionales.length > 0 && (
            <span className="badge bg-primary">
              {configsProfesionales.length} config{configsProfesionales.length > 1 ? 's' : ''} |
              Disponible: ${configsProfesionales.reduce((sum, c) => {
                const importe = c.modoSeleccionado === 'hora' ? Number(c.importeHora || 0) :
                                c.modoSeleccionado === 'dia' ? Number(c.importeDia || 0) :
                                c.modoSeleccionado === 'semana' ? Number(c.importeSemana || 0) :
                                Number(c.importeMes || 0);
                const cantidad = c.modoSeleccionado === 'hora' ? Number(c.cantidadHoras || 0) :
                                c.modoSeleccionado === 'dia' ? Number(c.cantidadDias || 0) :
                                c.modoSeleccionado === 'semana' ? Number(c.cantidadSemanas || 0) :
                                Number(c.cantidadMeses || 0);
                return sum + (importe * cantidad);
              }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            onClick={() => {
              setShowAddConfigMaterial(!showAddConfigMaterial);
            }}
          >
            + Configuración de Materiales
          </button>
          {configsMateriales.length > 0 && (
            <span className="badge bg-success">
              {configsMateriales.length} config{configsMateriales.length > 1 ? 's' : ''} |
              Disponible: ${configsMateriales.reduce((sum, c) => sum + Number(c.presupuestoTotal || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-info"
            onClick={() => {
              setShowAddConfigOtro(!showAddConfigOtro);
            }}
          >
            + Configuración de Otros Costos
          </button>
          {configsOtros.length > 0 && (
            <span className="badge bg-info text-dark">
              {configsOtros.length} config{configsOtros.length > 1 ? 's' : ''} |
              Disponible: ${configsOtros.reduce((sum, c) => sum + Number(c.presupuestoTotal || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      {/* ========== MODAL SELECCIÓN MÚLTIPLE DE TIPOS ========== */}
      {showSeleccionMultiple && (
        <div className="border rounded p-4 mb-3 bg-white shadow-sm">
          <h6 className="text-primary mb-3">🎯 Seleccionar Tipos de Profesionales</h6>
          <p className="text-muted small mb-3">
            Esta configuración general está siendo consumida por varios tipos de profesionales.
            Seleccione uno o varios para crear configuraciones específicas con su propia barra de progreso.
          </p>

          <div className="mb-3">
            {showSeleccionMultiple.tiposDisponibles.map((tipo, i) => (
              <div key={tipo} className="form-check mb-2 p-2 border rounded" style={{backgroundColor: showSeleccionMultiple.tiposSeleccionados.includes(tipo) ? '#e7f3ff' : '#f8f9fa'}}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`tipo-${i}`}
                  checked={showSeleccionMultiple.tiposSeleccionados.includes(tipo)}
                  onChange={() => toggleSeleccionTipo(tipo)}
                />
                <label className="form-check-label fw-bold" htmlFor={`tipo-${i}`}>
                  💼 {tipo}
                </label>
              </div>
            ))}
          </div>

          <div className="alert alert-info small mb-3">
            <strong>ℹ️ Importante:</strong> Se creará una configuración específica por cada tipo seleccionado.
            La configuración general actual será reemplazada por estas nuevas configuraciones específicas.
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={aplicarSeleccionMultiple}
              disabled={showSeleccionMultiple.tiposSeleccionados.length === 0}
            >
              ✓ Crear {showSeleccionMultiple.tiposSeleccionados.length} Configuración{showSeleccionMultiple.tiposSeleccionados.length !== 1 ? 'es' : ''}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelarSeleccionMultiple}
            >
              ✗ Cancelar
            </button>
          </div>

          {showSeleccionMultiple.tiposSeleccionados.length > 0 && (
            <div className="mt-3 p-2 bg-light border rounded">
              <small className="text-muted">
                <strong>Se crearán configuraciones para:</strong>
                <ul className="mb-0 mt-1">
                  {showSeleccionMultiple.tiposSeleccionados.map(tipo => (
                    <li key={tipo}>{tipo}</li>
                  ))}
                </ul>
              </small>
            </div>
          )}
        </div>
      )}

      {/* ========== FORMULARIO NUEVO PROFESIONAL ========== */}
      {showAddConfigProfesional && (
        <div className="border rounded p-3 mb-3 bg-white">
          <h6 className="text-primary mb-3">📋 Nueva Configuración de Profesionales</h6>

          {/* Checkbox para configuración general */}
          <div className="mb-3 p-2 border rounded" style={{backgroundColor: newConfigProfesional.esGeneral ? '#e7f3ff' : '#f8f9fa'}}>
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="esGeneralCheck"
                checked={newConfigProfesional.esGeneral}
                onChange={(e) => setNewConfigProfesional(prev => ({
                  ...prev,
                  esGeneral: e.target.checked,
                  tipoProfesional: e.target.checked ? '' : prev.tipoProfesional  // Limpiar tipo si es general
                }))}
              />
              <label className="form-check-label fw-bold" htmlFor="esGeneralCheck">
                ✨ Dejar tildado para consumo global de todos los profesionales
              </label>
            </div>
            <small className="text-muted d-block mt-1">
              {newConfigProfesional.esGeneral ? (
                <span className="text-primary">
                  ✅ <strong>Pool general:</strong> Ingrese cantidad de horas/días/semanas/meses e importe.
                  Todos los profesionales sin configuración específica consumirán de este presupuesto global.
                </span>
              ) : (
                <span>
                  💼 <strong>Config específica:</strong> Destildar para crear presupuesto exclusivo de un tipo de profesional
                  (ej: solo para Albañiles, solo para Electricistas, etc.)
                </span>
              )}
            </small>
          </div>

          {/* Campo tipo de profesional - solo si no es general */}
          {!newConfigProfesional.esGeneral && (
            <div className="mb-3">
              <label className="form-label fw-bold">Tipo de Profesional *</label>
              <input
                type="text"
                className="form-control"
                value={newConfigProfesional.tipoProfesional}
                onChange={(e) => setNewConfigProfesional(prev => ({ ...prev, tipoProfesional: e.target.value }))}
                placeholder="Ej: Arquitecto, Ingeniero, Albañil, Electricista..."
              />
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-bold mb-2">Modo de cálculo: Por hora</label>
            <input type="hidden" value="hora" />
          </div>

          {newConfigProfesional.modoSeleccionado && (
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  Importe por {newConfigProfesional.modoSeleccionado === 'hora' ? 'hora' :
                              newConfigProfesional.modoSeleccionado === 'dia' ? 'día' :
                              newConfigProfesional.modoSeleccionado === 'semana' ? 'semana' : 'mes'} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={
                    newConfigProfesional.modoSeleccionado === 'hora' ? newConfigProfesional.importeHora :
                    newConfigProfesional.modoSeleccionado === 'dia' ? newConfigProfesional.importeDia :
                    newConfigProfesional.modoSeleccionado === 'semana' ? newConfigProfesional.importeSemana :
                    newConfigProfesional.importeMes
                  }
                  onChange={(e) => {
                    const key = `importe${newConfigProfesional.modoSeleccionado.charAt(0).toUpperCase() + newConfigProfesional.modoSeleccionado.slice(1)}`;
                    setNewConfigProfesional(prev => ({ ...prev, [key]: e.target.value }));
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  Cantidad de {newConfigProfesional.modoSeleccionado === 'hora' ? 'horas' :
                              newConfigProfesional.modoSeleccionado === 'dia' ? 'días' :
                              newConfigProfesional.modoSeleccionado === 'semana' ? 'semanas' : 'meses'} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-control"
                  value={
                    newConfigProfesional.modoSeleccionado === 'hora' ? newConfigProfesional.cantidadHoras :
                    newConfigProfesional.modoSeleccionado === 'dia' ? newConfigProfesional.cantidadDias :
                    newConfigProfesional.modoSeleccionado === 'semana' ? newConfigProfesional.cantidadSemanas :
                    newConfigProfesional.cantidadMeses
                  }
                  onChange={(e) => {
                    const key = `cantidad${newConfigProfesional.modoSeleccionado.charAt(0).toUpperCase() + newConfigProfesional.modoSeleccionado.slice(1)}s`;
                    setNewConfigProfesional(prev => ({ ...prev, [key]: e.target.value }));
                  }}
                  placeholder="0"
                />
              </div>
              {(() => {
                const importe =
                  newConfigProfesional.modoSeleccionado === 'hora' ? Number(newConfigProfesional.importeHora || 0) :
                  newConfigProfesional.modoSeleccionado === 'dia' ? Number(newConfigProfesional.importeDia || 0) :
                  newConfigProfesional.modoSeleccionado === 'semana' ? Number(newConfigProfesional.importeSemana || 0) :
                  Number(newConfigProfesional.importeMes || 0);

                const cantidad =
                  newConfigProfesional.modoSeleccionado === 'hora' ? Number(newConfigProfesional.cantidadHoras || 0) :
                  newConfigProfesional.modoSeleccionado === 'dia' ? Number(newConfigProfesional.cantidadDias || 0) :
                  newConfigProfesional.modoSeleccionado === 'semana' ? Number(newConfigProfesional.cantidadSemanas || 0) :
                  Number(newConfigProfesional.cantidadMeses || 0);

                const total = importe * cantidad;

                return (
                  <div className="col-12">
                    <div className="alert alert-info mb-0">
                      <strong>Presupuesto Total:</strong> ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========== CAMPOS ADICIONALES: METROS CUADRADOS ========== */}
          <div className="border rounded p-3 mb-3" style={{backgroundColor: '#fff8e1'}}>
            <h6 className="mb-3">📐 Cálculo por Metros Cuadrados (Opcional)</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Metros Cuadrados (m²)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={newConfigProfesional.metrosCuadrados || ''}
                  onChange={(e) => setNewConfigProfesional(prev => ({ ...prev, metrosCuadrados: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Importe por m²</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={newConfigProfesional.importePorMetroCuadrado || ''}
                  onChange={(e) => setNewConfigProfesional(prev => ({ ...prev, importePorMetroCuadrado: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              {newConfigProfesional.metrosCuadrados && newConfigProfesional.importePorMetroCuadrado && (
                <div className="col-12">
                  <div className="alert alert-warning mb-0">
                    <strong>💰 Total por m²:</strong> ${(Number(newConfigProfesional.metrosCuadrados || 0) * Number(newConfigProfesional.importePorMetroCuadrado || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success btn-sm" onClick={acceptConfigProfesional}>
              ✓ Aceptar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelConfigProfesional}>
              ✗ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ========== FORMULARIO NUEVO MATERIAL ========== */}
      {showAddConfigMaterial && (
        <div className="border rounded p-3 mb-3 bg-white">
          <h6 className="text-success mb-3">🧱 Nueva Configuración de Materiales</h6>

          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="configMaterialGeneral"
              checked={newConfigMaterial.esGeneral}
              onChange={(e) => setNewConfigMaterial(prev => ({ ...prev, esGeneral: e.target.checked }))}
            />
            <label className="form-check-label" htmlFor="configMaterialGeneral">
              <strong>Configuración general (pool común)</strong>
              <small className="d-block text-muted">Consume materiales sin configuración específica</small>
            </label>
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">Tipo de Material {!newConfigMaterial.esGeneral && '*'}</label>
            <input
              type="text"
              className="form-control"
              value={newConfigMaterial.tipoMaterial}
              onChange={(e) => setNewConfigMaterial(prev => ({ ...prev, tipoMaterial: e.target.value }))}
              placeholder="Ej: Ladrillos, Cemento, Hierro, Pintura..."
              disabled={newConfigMaterial.esGeneral}
            />
            {newConfigMaterial.esGeneral && (
              <small className="text-muted">No aplica para configuración general</small>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">Presupuesto Total *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={newConfigMaterial.presupuestoTotal}
              onChange={(e) => setNewConfigMaterial(prev => ({ ...prev, presupuestoTotal: e.target.value }))}
              placeholder="0.00"
            />
            {newConfigMaterial.presupuestoTotal && (
              <div className="alert alert-info mt-2 mb-0">
                <strong>Presupuesto:</strong> ${Number(newConfigMaterial.presupuestoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {/* ========== CAMPOS ADICIONALES: METROS CUADRADOS ========== */}
          <div className="border rounded p-3 mb-3" style={{backgroundColor: '#fff8e1'}}>
            <h6 className="mb-3">📐 Cálculo por Metros Cuadrados (Opcional)</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Metros Cuadrados (m²)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={newConfigMaterial.metrosCuadrados || ''}
                  onChange={(e) => setNewConfigMaterial(prev => ({ ...prev, metrosCuadrados: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Importe por m²</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={newConfigMaterial.importePorMetroCuadrado || ''}
                  onChange={(e) => setNewConfigMaterial(prev => ({ ...prev, importePorMetroCuadrado: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              {newConfigMaterial.metrosCuadrados && newConfigMaterial.importePorMetroCuadrado && (
                <div className="col-12">
                  <div className="alert alert-warning mb-0">
                    <strong>💰 Total por m²:</strong> ${(Number(newConfigMaterial.metrosCuadrados || 0) * Number(newConfigMaterial.importePorMetroCuadrado || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success btn-sm" onClick={acceptConfigMaterial}>
              ✓ Aceptar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelConfigMaterial}>
              ✗ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ========== FORMULARIO NUEVO OTRO COSTO ========== */}
      {showAddConfigOtro && (
        <div className="border rounded p-3 mb-3 bg-white">
          <h6 className="text-info mb-3">💼 Nueva Configuración de Otros Costos</h6>

          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="configOtroGeneral"
              checked={newConfigOtro.esGeneral}
              onChange={(e) => setNewConfigOtro(prev => ({ ...prev, esGeneral: e.target.checked }))}
            />
            <label className="form-check-label" htmlFor="configOtroGeneral">
              <strong>Configuración general (pool común)</strong>
              <small className="d-block text-muted">Consume otros costos sin configuración específica</small>
            </label>
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">Descripción {!newConfigOtro.esGeneral && '*'}</label>
            <input
              type="text"
              className="form-control"
              value={newConfigOtro.descripcion}
              onChange={(e) => setNewConfigOtro(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Ej: Transporte, Equipamiento, Herramientas, Permisos..."
              disabled={newConfigOtro.esGeneral}
            />
            {newConfigOtro.esGeneral && (
              <small className="text-muted">No aplica para configuración general</small>
            )}
          </div>

          {/* NUEVO: Selector de Rubro */}
          <div className="mb-3">
            <label className="form-label fw-bold">
              Rubro (Opcional)
              <i className="fas fa-info-circle ms-1 text-muted" title="Seleccione un rubro para asociar estos costos a un grupo de tareas específico"></i>
            </label>
            <select
              className="form-select"
              value={newConfigOtro.rubro}
              onChange={(e) => setNewConfigOtro(prev => ({ ...prev, rubro: e.target.value }))}
            >
              <option value="">Seleccionar rubro...</option>
              <option value="Gastos Generales" style={{fontWeight: 'bold', color: '#6c757d'}}>
                ✨ Generales (Gastos no asociados a rubros específicos)
              </option>
              {itemsCalculadora.length > 0 && <option disabled>────────────────────</option>}
              {itemsCalculadora.map((item, idx) => (
                <option key={idx} value={item.tipoProfesional || `Rubro ${idx + 1}`}>
                  📁 {item.tipoProfesional || `Rubro ${idx + 1}`}
                </option>
              ))}
            </select>
            <small className="text-muted">
              {itemsCalculadora.length === 0 ? (
                <span>💡 Seleccione "Generales" para gastos no asociados a rubros específicos, o agregue grupos de tareas para más opciones.</span>
              ) : (
                <span>Seleccione "Generales" para gastos generales o un rubro específico</span>
              )}
            </small>
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">Presupuesto Total *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={newConfigOtro.presupuestoTotal}
              onChange={(e) => setNewConfigOtro(prev => ({ ...prev, presupuestoTotal: e.target.value }))}
              placeholder="0.00"
            />
            {newConfigOtro.presupuestoTotal && (
              <div className="alert alert-info mt-2 mb-0">
                <strong>Presupuesto:</strong> ${Number(newConfigOtro.presupuestoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {/* ========== CAMPOS ADICIONALES: METROS CUADRADOS ========== */}
          <div className="border rounded p-3 mb-3" style={{backgroundColor: '#fff8e1'}}>
            <h6 className="mb-3">📐 Cálculo por Metros Cuadrados (Opcional)</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Metros Cuadrados (m²)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={newConfigOtro.metrosCuadrados || ''}
                  onChange={(e) => setNewConfigOtro(prev => ({ ...prev, metrosCuadrados: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Importe por m²</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={newConfigOtro.importePorMetroCuadrado || ''}
                  onChange={(e) => setNewConfigOtro(prev => ({ ...prev, importePorMetroCuadrado: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              {newConfigOtro.metrosCuadrados && newConfigOtro.importePorMetroCuadrado && (
                <div className="col-12">
                  <div className="alert alert-warning mb-0">
                    <strong>💰 Total por m²:</strong> ${(Number(newConfigOtro.metrosCuadrados || 0) * Number(newConfigOtro.importePorMetroCuadrado || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success btn-sm" onClick={acceptConfigOtro}>
              ✓ Aceptar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelConfigOtro}>
              ✗ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ========== LISTA DE CONFIGURACIONES AGREGADAS ========== */}

      {/* Profesionales */}
      {configsProfesionales.length > 0 && (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="text-primary mb-0">👷 Configuraciones de Profesionales ({configsProfesionales.length})</h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setMostrarConfigsProfesionales(!mostrarConfigsProfesionales)}
            >
              {mostrarConfigsProfesionales ? '🔽 Ocultar' : '▶️ Mostrar'}
            </button>
          </div>

          {!mostrarConfigsProfesionales && (
            <div className="alert alert-info py-2 mb-2">
              <small>
                {configsProfesionales.length} configuración{configsProfesionales.length > 1 ? 'es' : ''} |
                Total disponible: ${configsProfesionales.reduce((sum, c) => {
                  const importe = c.modoSeleccionado === 'hora' ? Number(c.importeHora || 0) :
                                  c.modoSeleccionado === 'dia' ? Number(c.importeDia || 0) :
                                  c.modoSeleccionado === 'semana' ? Number(c.importeSemana || 0) :
                                  Number(c.importeMes || 0);
                  const cantidad = c.modoSeleccionado === 'hora' ? Number(c.cantidadHoras || 0) :
                                  c.modoSeleccionado === 'dia' ? Number(c.cantidadDias || 0) :
                                  c.modoSeleccionado === 'semana' ? Number(c.cantidadSemanas || 0) :
                                  Number(c.cantidadMeses || 0);
                  return sum + (importe * cantidad);
                }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </small>
            </div>
          )}

          {mostrarConfigsProfesionales && (
            <>
              {configsProfesionales.map((config, idx) => {
            const importe =
              config.modoSeleccionado === 'hora' ? Number(config.importeHora || 0) :
              config.modoSeleccionado === 'dia' ? Number(config.importeDia || 0) :
              config.modoSeleccionado === 'semana' ? Number(config.importeSemana || 0) :
              Number(config.importeMes || 0);

            const cantidad =
              config.modoSeleccionado === 'hora' ? Number(config.cantidadHoras || 0) :
              config.modoSeleccionado === 'dia' ? Number(config.cantidadDias || 0) :
              config.modoSeleccionado === 'semana' ? Number(config.cantidadSemanas || 0) :
              Number(config.cantidadMeses || 0);

            const totalPresupuesto = importe * cantidad;
            const unidad =
              config.modoSeleccionado === 'hora' ? 'horas' :
              config.modoSeleccionado === 'dia' ? 'días' :
              config.modoSeleccionado === 'semana' ? 'semanas' : 'meses';

            // Calcular consumo
            const { totalTiempoConsumido, totalImporteConsumido } = calcularConsumoProfesional(config);
            const tiempoRestante = cantidad - totalTiempoConsumido;
            const importeRestante = totalPresupuesto - totalImporteConsumido;
            const porcentajeConsumido = totalPresupuesto > 0 ? (totalImporteConsumido / totalPresupuesto) * 100 : 0;

            return (
              <div
                key={idx}
                className="border rounded p-3 mb-2"
                style={{
                  backgroundColor: config.esGeneral ? '#e7f3ff' : '#f0f8ff',
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <strong className="d-block mb-1">
                      {config.esGeneral ? (
                        <span>✨ <span className="badge bg-primary">CONFIGURACIÓN GENERAL</span> (Todos los profesionales)</span>
                      ) : (
                        <span>💼 {config.tipoProfesional}</span>
                      )}
                    </strong>
                    <small className="text-muted">
                      Presupuesto: {cantidad} {unidad} × ${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })} = ${totalPresupuesto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </small>
                  </div>
                  {!soloLectura && (
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm"
                        onClick={() => iniciarAgregarDisponible(idx)}
                        title="Agregar más disponible a esta configuración"
                      >
                        ➕ Agregar Disponible
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${config.esGeneral ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                        onClick={() => toggleConfiguracionGeneral(idx)}
                        title={config.esGeneral ? 'Convertir a configuración específica' : 'Convertir a configuración general'}
                      >
                        {config.esGeneral ? '💼 Hacer Específica' : '✨ Hacer General'}
                      </button>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeConfigProfesional(idx)}>
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Formulario para agregar disponible */}
                {editingConfigProfesional && editingConfigProfesional.index === idx && (
                  <div className="border rounded p-3 mb-2 bg-light">
                    <h6 className="text-success mb-3">➕ Agregar Disponible</h6>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Cantidad de {unidad} a agregar *</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="form-control"
                          value={editingConfigProfesional.cantidadAdicional}
                          onChange={(e) => setEditingConfigProfesional(prev => ({
                            ...prev,
                            cantidadAdicional: e.target.value
                          }))}
                          placeholder={`Ej: 50 ${unidad}`}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Importe por {config.modoSeleccionado} *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={editingConfigProfesional.importeAdicional}
                          onChange={(e) => setEditingConfigProfesional(prev => ({
                            ...prev,
                            importeAdicional: e.target.value
                          }))}
                          placeholder="Importe unitario"
                        />
                      </div>
                    </div>
                    <div className="mt-3 d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={aplicarDisponibleAdicional}
                      >
                        ✓ Aplicar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={cancelarAgregarDisponible}
                      >
                        ✗ Cancelar
                      </button>
                    </div>
                    <small className="text-muted d-block mt-2">
                      💡 Se sumarán {editingConfigProfesional.cantidadAdicional || '0'} {unidad} al disponible actual
                      {editingConfigProfesional.cantidadAdicional && editingConfigProfesional.importeAdicional &&
                        ` = $${(Number(editingConfigProfesional.cantidadAdicional) * Number(editingConfigProfesional.importeAdicional)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                      }
                    </small>
                  </div>
                )}

                {/* Barra de progreso */}
                <div className="progress mb-2" style={{height: '20px'}}>
                  <div
                    className={`progress-bar ${porcentajeConsumido > 100 ? 'bg-danger' : porcentajeConsumido > 70 ? 'bg-warning' : 'bg-success'}`}
                    role="progressbar"
                    style={{width: `${Math.min(porcentajeConsumido, 100)}%`}}
                    aria-valuenow={porcentajeConsumido}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {porcentajeConsumido.toFixed(0)}%
                  </div>
                </div>

                {/* Desglose por tipo de profesional */}
                {(() => {
                  // Calcular consumo por tipo de profesional
                  const consumoPorTipo = {};

                  profesionalesAgregados.forEach(prof => {
                    // Determinar si este profesional consume de esta configuración
                    let debeContar = false;

                    if (config.esGeneral) {
                      // CAMBIO: La GENERAL ahora muestra TODOS los profesionales
                      debeContar = true;
                    } else {
                      debeContar = prof.tipoProfesional?.toLowerCase() === config.tipoProfesional?.toLowerCase();
                    }

                    if (debeContar) {
                      const tipo = prof.tipoProfesional || 'Sin tipo';
                      if (!consumoPorTipo[tipo]) {
                        consumoPorTipo[tipo] = { tiempo: 0, importe: 0 };
                      }

                      // Sumar consumo de este profesional
                      if (prof.importeXHora && Number(prof.cantidadHoras || 0) > 0) {
                        const cantidad = Number(prof.cantidadHoras || 0);
                        const importe = Number(prof.importeXHora || 0) * cantidad;
                        const cantidadConvertida = habilitarConversion ? convertirTiempo(cantidad, 'hora', config.modoSeleccionado) : (config.modoSeleccionado === 'hora' ? cantidad : 0);
                        consumoPorTipo[tipo].tiempo += cantidadConvertida;
                        consumoPorTipo[tipo].importe += importe;
                      }
                      if (prof.importeXDia && Number(prof.cantidadDias || 0) > 0) {
                        const cantidad = Number(prof.cantidadDias || 0);
                        const importe = Number(prof.importeXDia || 0) * cantidad;
                        const cantidadConvertida = habilitarConversion ? convertirTiempo(cantidad, 'dia', config.modoSeleccionado) : (config.modoSeleccionado === 'dia' ? cantidad : 0);
                        consumoPorTipo[tipo].tiempo += cantidadConvertida;
                        consumoPorTipo[tipo].importe += importe;
                      }
                      if (prof.importeXSemana && Number(prof.cantidadSemanas || 0) > 0) {
                        const cantidad = Number(prof.cantidadSemanas || 0);
                        const importe = Number(prof.importeXSemana || 0) * cantidad;
                        const cantidadConvertida = habilitarConversion ? convertirTiempo(cantidad, 'semana', config.modoSeleccionado) : (config.modoSeleccionado === 'semana' ? cantidad : 0);
                        consumoPorTipo[tipo].tiempo += cantidadConvertida;
                        consumoPorTipo[tipo].importe += importe;
                      }
                      if (prof.importeXMes && Number(prof.cantidadMeses || 0) > 0) {
                        const cantidad = Number(prof.cantidadMeses || 0);
                        const importe = Number(prof.importeXMes || 0) * cantidad;
                        const cantidadConvertida = habilitarConversion ? convertirTiempo(cantidad, 'mes', config.modoSeleccionado) : (config.modoSeleccionado === 'mes' ? cantidad : 0);
                        consumoPorTipo[tipo].tiempo += cantidadConvertida;
                        consumoPorTipo[tipo].importe += importe;
                      }
                    }
                  });

                  const tipos = Object.keys(consumoPorTipo);

                  return tipos.length > 0 && (
                    <div className="mb-2">
                      <small className="text-muted d-block mb-1"><strong>📊 Desglose por tipo:</strong></small>
                      {tipos.map((tipo, i) => {
                        const datos = consumoPorTipo[tipo];
                        const porcentaje = totalPresupuesto > 0 ? (datos.importe / totalPresupuesto) * 100 : 0;
                        const colores = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8', '#e83e8c'];
                        const color = colores[i % colores.length];

                        return (
                          <div key={tipo} className="mb-1">
                            <div className="d-flex justify-content-between align-items-center" style={{fontSize: '0.85rem'}}>
                              <span>
                                <span style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  backgroundColor: color,
                                  borderRadius: '2px',
                                  marginRight: '5px'
                                }}></span>
                                {tipo}
                              </span>
                              <span className="text-muted">
                                {datos.tiempo.toFixed(2)} {unidad} ({porcentaje.toFixed(1)}%) → ${datos.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="progress" style={{height: '6px'}}>
                              <div
                                className="progress-bar"
                                style={{width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color}}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Detalles de consumo */}
                <div className="small">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Consumido:</span>
                    <span className="fw-bold" style={{transition: 'all 0.3s ease'}}>
                      {totalTiempoConsumido.toFixed(2)} {unidad} → ${totalImporteConsumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Restante:</span>
                    <span className={`fw-bold ${tiempoRestante < 0 || importeRestante < 0 ? 'text-danger' : 'text-success'}`} style={{transition: 'all 0.3s ease'}}>
                      {tiempoRestante.toFixed(2)} {unidad} → ${importeRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      {(tiempoRestante < 0 || importeRestante < 0) && ' ⚠️ EXCEDIDO'}
                    </span>
                  </div>

                  {/* Indicador de qué tipos consumen esta configuración */}
                  {config.esGeneral && (
                    <div className="mt-2 pt-2 border-top">
                      <small className="text-muted">
                        ℹ️ <em>Muestra TODOS los profesionales (incluye los que tienen configuración específica)</em>
                      </small>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
            </>
          )}
        </div>
      )}

      {/* Materiales */}
      {configsMateriales.length > 0 && (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="text-success mb-0">🧱 Configuraciones de Materiales ({configsMateriales.length})</h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => setMostrarConfigsMateriales(!mostrarConfigsMateriales)}
            >
              {mostrarConfigsMateriales ? '🔽 Ocultar' : '▶️ Mostrar'}
            </button>
          </div>

          {!mostrarConfigsMateriales && (
            <div className="alert alert-success py-2 mb-2">
              <small>
                {configsMateriales.length} configuración{configsMateriales.length > 1 ? 'es' : ''} |
                Total disponible: ${configsMateriales.reduce((sum, c) => sum + Number(c.presupuestoTotal || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </small>
            </div>
          )}

          {mostrarConfigsMateriales && (
            <>
              {configsMateriales.map((config, idx) => {
            const presupuestoTotal = Number(config.presupuestoTotal || 0);
            const consumido = calcularConsumoMaterial(config);
            const restante = presupuestoTotal - consumido;
            const porcentajeConsumido = presupuestoTotal > 0 ? (consumido / presupuestoTotal) * 100 : 0;

            return (
              <div
                key={idx}
                className="border rounded p-3 mb-2"
                style={{
                  backgroundColor: config.esGeneral ? '#d4edda' : '#e8f5e9',
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <strong className="d-block mb-1">
                      {config.esGeneral ? (
                        <span>✨ <span className="badge bg-success">CONFIGURACIÓN GENERAL</span> (Todos los materiales)</span>
                      ) : (
                        <span>🧱 {config.tipoMaterial}</span>
                      )}
                    </strong>
                    <small className="text-muted">
                      Presupuesto: ${presupuestoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </small>
                  </div>
                  {!soloLectura && (
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm"
                        onClick={() => iniciarAgregarDisponibleMaterial(idx)}
                        title="Agregar más disponible a esta configuración"
                      >
                        ➕ Agregar Disponible
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${config.esGeneral ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                        onClick={() => toggleConfiguracionGeneralMaterial(idx)}
                        title={config.esGeneral ? 'Convertir a configuración específica' : 'Convertir a configuración general'}
                      >
                        {config.esGeneral ? '🧱 Hacer Específica' : '✨ Hacer General'}
                      </button>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeConfigMaterial(idx)}>
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Formulario para agregar disponible */}
                {editingConfigMaterial && editingConfigMaterial.index === idx && (
                  <div className="border rounded p-3 mb-2 bg-light">
                    <h6 className="text-success mb-3">➕ Agregar Disponible</h6>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Monto adicional a agregar *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={editingConfigMaterial.montoAdicional}
                        onChange={(e) => setEditingConfigMaterial(prev => ({
                          ...prev,
                          montoAdicional: e.target.value
                        }))}
                        placeholder="Ej: 10000.00"
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={aplicarDisponibleAdicionalMaterial}
                      >
                        ✓ Aplicar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingConfigMaterial(null)}
                      >
                        ✗ Cancelar
                      </button>
                    </div>
                    <small className="text-muted d-block mt-2">
                      💡 Se sumarán ${Number(editingConfigMaterial.montoAdicional || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} al presupuesto actual
                    </small>
                  </div>
                )}

                {/* Barra de progreso */}
                <div className="progress mb-2" style={{height: '20px'}}>
                  <div
                    className={`progress-bar ${porcentajeConsumido > 100 ? 'bg-danger' : porcentajeConsumido > 70 ? 'bg-warning' : 'bg-success'}`}
                    role="progressbar"
                    style={{width: `${Math.min(porcentajeConsumido, 100)}%`}}
                    aria-valuenow={porcentajeConsumido}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {porcentajeConsumido.toFixed(0)}%
                  </div>
                </div>

                {/* Desglose por tipo de material */}
                {(() => {
                  const consumoPorTipo = {};

                  materialesAgregados.forEach(mat => {
                    let debeContar = false;

                    if (config.esGeneral) {
                      // General muestra todos los materiales sin configuración específica
                      const tieneConfigEspecifica = configsMateriales.some(c =>
                        !c.esGeneral && c.tipoMaterial?.toLowerCase() === mat.tipoMaterial?.toLowerCase()
                      );
                      debeContar = !tieneConfigEspecifica;
                    } else {
                      debeContar = mat.tipoMaterial?.toLowerCase() === config.tipoMaterial?.toLowerCase();
                    }

                    if (debeContar) {
                      const tipo = mat.tipoMaterial || 'Sin tipo';
                      if (!consumoPorTipo[tipo]) {
                        consumoPorTipo[tipo] = 0;
                      }
                      consumoPorTipo[tipo] += Number(mat.costo || 0);
                    }
                  });

                  const tipos = Object.keys(consumoPorTipo);

                  return tipos.length > 0 && (
                    <div className="mb-2">
                      <small className="text-muted d-block mb-1"><strong>📊 Desglose por tipo:</strong></small>
                      {tipos.map((tipo, i) => {
                        const costo = consumoPorTipo[tipo];
                        const porcentaje = presupuestoTotal > 0 ? (costo / presupuestoTotal) * 100 : 0;
                        const colores = ['#28a745', '#20c997', '#17a2b8', '#007bff', '#6610f2', '#e83e8c'];
                        const color = colores[i % colores.length];

                        return (
                          <div key={tipo} className="mb-1">
                            <div className="d-flex justify-content-between align-items-center" style={{fontSize: '0.85rem'}}>
                              <span>
                                <span style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  backgroundColor: color,
                                  borderRadius: '2px',
                                  marginRight: '5px'
                                }}></span>
                                {tipo}
                              </span>
                              <span className="text-muted">
                                ({porcentaje.toFixed(1)}%) → ${costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="progress" style={{height: '6px'}}>
                              <div
                                className="progress-bar"
                                style={{width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color}}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Detalles de consumo */}
                <div className="small">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Consumido:</span>
                    <span className="fw-bold">${consumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Restante:</span>
                    <span className={`fw-bold ${restante < 0 ? 'text-danger' : 'text-success'}`}>
                      ${restante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      {restante < 0 && ' ⚠️ EXCEDIDO'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
            </>
          )}
        </div>
      )}

      {/* Otros Costos */}
      {configsOtros.length > 0 && (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="text-info mb-0">💼 Configuraciones de Otros Costos ({configsOtros.length})</h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-info"
              onClick={() => setMostrarConfigsOtros(!mostrarConfigsOtros)}
            >
              {mostrarConfigsOtros ? '🔽 Ocultar' : '▶️ Mostrar'}
            </button>
          </div>

          {!mostrarConfigsOtros && (
            <div className="alert alert-warning py-2 mb-2">
              <small>
                {configsOtros.length} configuración{configsOtros.length > 1 ? 'es' : ''} |
                Total disponible: ${configsOtros.reduce((sum, c) => sum + Number(c.presupuestoTotal || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </small>
            </div>
          )}

          {mostrarConfigsOtros && (
            <>
              {configsOtros.map((config, idx) => {
            const presupuestoTotal = Number(config.presupuestoTotal || 0);
            const consumido = calcularConsumoOtro(config);
            const restante = presupuestoTotal - consumido;
            const porcentajeConsumido = presupuestoTotal > 0 ? (consumido / presupuestoTotal) * 100 : 0;

            return (
              <div
                key={idx}
                className="border rounded p-3 mb-2"
                style={{
                  backgroundColor: config.esGeneral ? '#d1ecf1' : '#e3f2fd',
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <strong className="d-block mb-1">
                      {config.esGeneral ? (
                        <span>✨ <span className="badge bg-info">CONFIGURACIÓN GENERAL</span> (Todos los otros costos)</span>
                      ) : (
                        <span>💼 {config.descripcion}</span>
                      )}
                    </strong>
                    {config.rubro && (
                      <div className="mb-1">
                        <span className="badge bg-secondary">
                          <i className="fas fa-folder me-1"></i>Rubro: {config.rubro}
                        </span>
                      </div>
                    )}
                    <small className="text-muted">
                      Presupuesto: ${presupuestoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </small>
                  </div>
                  {!soloLectura && (
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-info btn-sm"
                        onClick={() => iniciarAgregarDisponibleOtro(idx)}
                        title="Agregar más disponible a esta configuración"
                      >
                        ➕ Agregar Disponible
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${config.esGeneral ? 'btn-outline-secondary' : 'btn-outline-info'}`}
                        onClick={() => toggleConfiguracionGeneralOtro(idx)}
                        title={config.esGeneral ? 'Convertir a configuración específica' : 'Convertir a configuración general'}
                      >
                        {config.esGeneral ? '💼 Hacer Específica' : '✨ Hacer General'}
                      </button>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeConfigOtro(idx)}>
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Formulario para agregar disponible */}
                {editingConfigOtro && editingConfigOtro.index === idx && (
                  <div className="border rounded p-3 mb-2 bg-light">
                    <h6 className="text-info mb-3">➕ Agregar Disponible</h6>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Monto adicional a agregar *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={editingConfigOtro.montoAdicional}
                        onChange={(e) => setEditingConfigOtro(prev => ({
                          ...prev,
                          montoAdicional: e.target.value
                        }))}
                        placeholder="Ej: 10000.00"
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-info btn-sm"
                        onClick={aplicarDisponibleAdicionalOtro}
                      >
                        ✓ Aplicar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingConfigOtro(null)}
                      >
                        ✗ Cancelar
                      </button>
                    </div>
                    <small className="text-muted d-block mt-2">
                      💡 Se sumarán ${Number(editingConfigOtro.montoAdicional || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} al presupuesto actual
                    </small>
                  </div>
                )}

                {/* Barra de progreso */}
                <div className="progress mb-2" style={{height: '20px'}}>
                  <div
                    className={`progress-bar ${porcentajeConsumido > 100 ? 'bg-danger' : porcentajeConsumido > 70 ? 'bg-warning' : 'bg-success'}`}
                    role="progressbar"
                    style={{width: `${Math.min(porcentajeConsumido, 100)}%`}}
                    aria-valuenow={porcentajeConsumido}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {porcentajeConsumido.toFixed(0)}%
                  </div>
                </div>

                {/* Desglose por descripción */}
                {(() => {
                  const consumoPorDescripcion = {};

                  otrosCostosAgregados.forEach(otro => {
                    let debeContar = false;

                    if (config.esGeneral) {
                      // General muestra todos los otros costos sin configuración específica
                      const tieneConfigEspecifica = configsOtros.some(c =>
                        !c.esGeneral && c.descripcion?.toLowerCase() === otro.descripcion?.toLowerCase()
                      );
                      debeContar = !tieneConfigEspecifica;
                    } else {
                      debeContar = otro.descripcion?.toLowerCase() === config.descripcion?.toLowerCase();
                    }

                    if (debeContar) {
                      const desc = otro.descripcion || 'Sin descripción';
                      if (!consumoPorDescripcion[desc]) {
                        consumoPorDescripcion[desc] = 0;
                      }
                      consumoPorDescripcion[desc] += Number(otro.costo || 0);
                    }
                  });

                  const descripciones = Object.keys(consumoPorDescripcion);

                  return descripciones.length > 0 && (
                    <div className="mb-2">
                      <small className="text-muted d-block mb-1"><strong>📊 Desglose por descripción:</strong></small>
                      {descripciones.map((desc, i) => {
                        const costo = consumoPorDescripcion[desc];
                        const porcentaje = presupuestoTotal > 0 ? (costo / presupuestoTotal) * 100 : 0;
                        const colores = ['#17a2b8', '#007bff', '#6610f2', '#e83e8c', '#fd7e14', '#20c997'];
                        const color = colores[i % colores.length];

                        return (
                          <div key={desc} className="mb-1">
                            <div className="d-flex justify-content-between align-items-center" style={{fontSize: '0.85rem'}}>
                              <span>
                                <span style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  backgroundColor: color,
                                  borderRadius: '2px',
                                  marginRight: '5px'
                                }}></span>
                                {desc}
                              </span>
                              <span className="text-muted">
                                ({porcentaje.toFixed(1)}%) → ${costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="progress" style={{height: '6px'}}>
                              <div
                                className="progress-bar"
                                style={{width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color}}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Detalles de consumo */}
                <div className="small">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Consumido:</span>
                    <span className="fw-bold">${consumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Restante:</span>
                    <span className={`fw-bold ${restante < 0 ? 'text-danger' : 'text-success'}`}>
                      ${restante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      {restante < 0 && ' ⚠️ EXCEDIDO'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
            </>
          )}
        </div>
      )}

      {/* Mensaje si no hay configuraciones */}
      {configsProfesionales.length === 0 && configsMateriales.length === 0 && configsOtros.length === 0 && (
        <div className="text-muted small text-center py-3">
          No hay configuraciones de presupuesto agregadas. Use los botones superiores para agregar.
        </div>
      )}
      </>
    )}

      {/* ========== SECCIÓN DE HONORARIOS ========== */}
      {(mostrarSolo === 'ambos' || mostrarSolo === 'honorarios') && !soloLectura && (
        <div className={`mt-3 border rounded p-3 ${ocultarHonorariosEnPDF ? 'ocultar-en-pdf' : ''}`} style={{backgroundColor: '#f8f9fa'}}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6
              className="mb-0"
              style={{cursor: 'pointer', fontWeight: 'bold', color: '#d9534f'}}
              onClick={() => {
                setMostrarHonorarios(!mostrarHonorarios);
                // Si honorarios es null, inicializarlo cuando se abre por primera vez
                if (!mostrarHonorarios && !honorariosActual) {
                  setHonorarios({
                    valorGeneral: '',
                    tipoGeneral: 'porcentaje',
                    profesionales: { activo: true, tipo: 'porcentaje', valor: '' },
                    materiales: { activo: true, tipo: 'porcentaje', valor: '' },
                    otrosCostos: { activo: true, tipo: 'porcentaje', valor: '' },
                    configuracionPresupuesto: { activo: true, tipo: 'porcentaje', valor: '' }
                  });
                }
              }}
            >
              💰 Configuración de Honorarios
              <span className="ms-2 small">{mostrarHonorarios ? '▼' : '▶'}</span>
            </h6>

            <div className="form-check form-switch" onClick={(e) => e.stopPropagation()}>
              <input
                className="form-check-input"
                type="checkbox"
                id="ocultarHonorariosEnPDF"
                checked={ocultarHonorariosEnPDF}
                onChange={(e) => setOcultarHonorariosEnPDF(e.target.checked)}
                title="Si está marcado, esta sección NO aparecerá en el PDF"
              />
              <label className="form-check-label small text-muted" htmlFor="ocultarHonorariosEnPDF" title="Si está marcado, esta sección NO aparecerá en el PDF">
                🔒 Ocultar en PDF
              </label>
            </div>
          </div>

          {mostrarHonorarios && honorariosActual && (
            <div className="border rounded p-3" style={{backgroundColor: '#f8d7da'}}>
              {/* Solo selector de rubro e importar datos */}
              <div className="d-flex align-items-center mb-3">
                <h6 className="text-primary mb-0 me-3">📊 Importar Datos de Rubro</h6>

                {/* Selector de rubros para importar datos */}
                <select
                  className="form-select form-select-sm me-2"
                  style={{ width: '200px' }}
                  value={rubroSeleccionado}
                  onChange={(e) => setRubroSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar rubro...</option>
                  {itemsCalculadora && itemsCalculadora.length > 0 && itemsCalculadora.map((item, index) => (
                    <option key={item.id || index} value={item.id || index}>
                      {item.tipoProfesional || `Rubro ${index + 1}`}
                    </option>
                  ))}
                </select>

                <button
                    type="button"
                    className={`btn btn-sm ${honorariosActual.generalImportado ? 'btn-warning' : 'btn-outline-primary'}`}
                    onClick={() => {
                      if (!honorariosActual.generalImportado) {
                        // Lógica para importar datos del rubro seleccionado
                        if (rubroSeleccionado) {
                          const rubroItem = itemsCalculadora.find(item => (item.id || itemsCalculadora.indexOf(item)) == rubroSeleccionado);
                          if (rubroItem) {
                            // Cargar valores guardados para este rubro específico
                            const valoresGuardadosRubro = cargarValoresGuardadosHonorarios(rubroItem.tipoProfesional);

                            setHonorarios(prev => ({
                              ...prev,
                              generalImportado: true,
                              rubroImportado: rubroSeleccionado,
                              nombreRubroImportado: rubroItem.tipoProfesional,
                              // Activar todas las secciones y usar valores guardados si existen, sino defaults
                              profesionales: {
                                ...prev.profesionales,
                                activo: true,
                                tipo: valoresGuardadosRubro?.profesionales?.tipo || prev.profesionales.tipo || 'porcentaje',
                                valor: valoresGuardadosRubro?.profesionales?.valor || prev.profesionales.valor || '10'
                              },
                              materiales: {
                                ...prev.materiales,
                                activo: true,
                                tipo: valoresGuardadosRubro?.materiales?.tipo || prev.materiales.tipo || 'porcentaje',
                                valor: valoresGuardadosRubro?.materiales?.valor || prev.materiales.valor || '10'
                              },
                              otrosCostos: {
                                ...prev.otrosCostos,
                                activo: true,
                                tipo: valoresGuardadosRubro?.otrosCostos?.tipo || prev.otrosCostos.tipo || 'porcentaje',
                                valor: valoresGuardadosRubro?.otrosCostos?.valor || prev.otrosCostos.valor || '10'
                              },
                              configuracionPresupuesto: {
                                ...prev.configuracionPresupuesto,
                                activo: true,
                                tipo: valoresGuardadosRubro?.configuracionPresupuesto?.tipo || prev.configuracionPresupuesto.tipo || 'porcentaje',
                                valor: valoresGuardadosRubro?.configuracionPresupuesto?.valor || prev.configuracionPresupuesto.valor || '10'
                              }
                            }));

                            console.log('📊 Datos importados del rubro:', rubroItem.tipoProfesional);
                            if (valoresGuardadosRubro) {
                              console.log('💾 Valores guardados cargados:', valoresGuardadosRubro);
                            }
                            console.log('💰 Totales del rubro:', {
                              profesionales: rubroItem.subtotalManoObra,
                              materiales: rubroItem.subtotalMateriales,
                              gastosGenerales: rubroItem.subtotalGastosGenerales
                            });
                          } else {
                            alert('⚠️ No se encontró el rubro seleccionado');
                          }
                        } else {
                          // Comportamiento original si no hay rubro seleccionado
                          setHonorarios(prev => ({
                            ...prev,
                            generalImportado: true,
                            rubroImportado: null,
                            nombreRubroImportado: null,
                            profesionales: { ...prev.profesionales, activo: true, valor: prev.profesionales.valor || '10' },
                            materiales: { ...prev.materiales, activo: true, valor: prev.materiales.valor || '10' },
                            otrosCostos: { ...prev.otrosCostos, activo: true, valor: prev.otrosCostos.valor || '10' },
                            configuracionPresupuesto: { ...prev.configuracionPresupuesto, activo: true, valor: prev.configuracionPresupuesto.valor || '10' }
                          }));
                        }
                      } else {
                        setHonorarios(prev => ({
                          ...prev,
                          generalImportado: false,
                          rubroImportado: null,
                          nombreRubroImportado: null,
                          profesionales: { ...prev.profesionales, activo: false, valor: '' },
                          materiales: { ...prev.materiales, activo: false, valor: '' },
                          otrosCostos: { ...prev.otrosCostos, activo: false, valor: '' },
                          configuracionPresupuesto: { ...prev.configuracionPresupuesto, activo: false, valor: '' }
                        }));
                        setRubroSeleccionado('');
                      }
                    }}
                    disabled={!honorariosActual.generalImportado && !rubroSeleccionado}
                    >
                    <i className={`fas ${honorariosActual.generalImportado ? 'fa-undo' : 'fa-download'} me-1`}></i>
                    {honorariosActual.generalImportado ? 'Quitar datos' : 'Importar datos'}
                  </button>
              </div>

              {/* Mensaje informativo */}
              {honorariosActual.generalImportado && (
                <div className="alert alert-info py-2 px-3 mb-3">
                  <small>
                    <i className="fas fa-info-circle me-2"></i>
                    <strong>Datos importados:</strong> Configure los honorarios específicos en cada tarjeta individual.
                    {honorariosActual.nombreRubroImportado && (
                      <span className="ms-2 badge bg-primary">{honorariosActual.nombreRubroImportado}</span>
                    )}
                    {valoresGuardados && (
                      <span className="ms-2 badge bg-success">
                        <i className="fas fa-history me-1"></i>Valores previos cargados
                      </span>
                    )}
                  </small>
                </div>
              )}

              {/* Configuración Individual para cada categoría */}
              {/* Nota: Las tarjetas de configuración individual se han eliminado ya que
                  ahora los controles están integrados directamente en las tarjetas del resumen */}


              {/* Resumen de Honorarios */}
              {(() => {
                // 🎯 Usar rubro específico si se importaron datos de un rubro
                const resumen = calcularResumenHonorarios(honorariosActual.rubroImportado);
                const hayValores = resumen.totales.base > 0 || resumen.totales.honorarios > 0;



                return hayValores && (
                  <div className="mt-4 border rounded p-3 bg-white">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="text-success mb-0">
                        📊 Resumen de Honorarios
                        {resumen.rubroEspecifico && (
                          <span className="ms-2 badge bg-info text-white">
                            Rubro: {resumen.rubroEspecifico}
                          </span>
                        )}
                      </h6>

                      {/* ✨ Switch para aplicar mismo % a todos los items */}
                      <div className="d-flex align-items-center gap-2">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="switchGlobalHonorarios"
                            checked={aplicarGlobalHonorarios}
                            onChange={(e) => setAplicarGlobalHonorarios(e.target.checked)}
                          />
                          <label className="form-check-label small fw-bold text-muted" htmlFor="switchGlobalHonorarios">
                            Asignar el mismo % a todos los items
                          </label>
                        </div>

                        {/* Input global - solo visible si el switch está activado */}
                        {aplicarGlobalHonorarios && (
                          <div className="d-flex gap-1 align-items-center" style={{minWidth: '150px'}}>
                            <select
                              className="form-select form-select-sm"
                              style={{fontSize: '10px', padding: '4px', width: '60px'}}
                              value={tipoGlobalHonorarios}
                              onChange={(e) => setTipoGlobalHonorarios(e.target.value)}
                            >
                              <option value="porcentaje">%</option>
                              <option value="fijo">$</option>
                            </select>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="Valor"
                              value={valorGlobalHonorarios}
                              onChange={(e) => {
                                const valor = e.target.value;
                                setValorGlobalHonorarios(valor);

                                // Aplicar automáticamente a todos los items
                                if (valor && onHonorariosChange) {
                                  const nuevoHonorarios = {
                                    ...honorariosActual,
                                    jornales: { ...honorariosActual.jornales, tipo: tipoGlobalHonorarios, valor: valor },
                                    profesionales: { ...honorariosActual.profesionales, tipo: tipoGlobalHonorarios, valor: valor },
                                    materiales: { ...honorariosActual.materiales, tipo: tipoGlobalHonorarios, valor: valor },
                                    otrosCostos: { ...honorariosActual.otrosCostos, tipo: tipoGlobalHonorarios, valor: valor },
                                    configuracionPresupuesto: { ...honorariosActual.configuracionPresupuesto, tipo: tipoGlobalHonorarios, valor: valor }
                                  };
                                  onHonorariosChange(nuevoHonorarios);
                                }
                              }}
                              style={{fontSize: '11px', padding: '4px', width: '80px'}}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      {/* Jornales */}
                      {resumen.jornales && resumen.jornales.base > 0 && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <small className="text-muted d-block mb-2">🏗️ Jornales</small>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base:</span>
                            <span className="small fw-bold">${(resumen.jornales.baseOriginal || resumen.jornales.base).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Selector de modo: Aplicar a todos o por rol */}
                          <div className="mt-2 mb-2">
                            <select
                              className="form-select form-select-sm mb-2"
                              style={{ fontSize: '11px' }}
                              value={honorariosActual.jornales?.modoAplicacion || 'todos'}
                              onChange={(e) => {
                                const nuevoModo = e.target.value;
                                setHonorarios(prev => ({
                                  ...prev,
                                  jornales: {
                                    ...prev.jornales,
                                    modoAplicacion: nuevoModo,
                                    // Si cambia a "todos", limpiar valores por rol
                                    porRol: nuevoModo === 'todos' ? {} : (prev.jornales?.porRol || {})
                                  }
                                }));
                              }}
                            >
                              <option value="todos">✓ Aplicar a TODOS los roles</option>
                              <option value="porRol">⚙️ Configurar POR ROL</option>
                            </select>

                            {/* Controles según el modo */}
                            {honorariosActual.jornales?.modoAplicacion === 'porRol' ? (
                              <div className="border rounded p-2 bg-white" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {(() => {
                                  // Obtener roles únicos de jornales
                                  const rolesUnicos = new Set();
                                  if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
                                    itemsCalculadora.forEach(item => {
                                      if (item.jornales && Array.isArray(item.jornales)) {
                                        item.jornales.forEach(jornal => {
                                          if (jornal.rol) rolesUnicos.add(jornal.rol);
                                        });
                                      }
                                    });
                                  }

                                  const rolesArray = Array.from(rolesUnicos);

                                  if (rolesArray.length === 0) {
                                    return <small className="text-muted fst-italic">No hay roles de jornales</small>;
                                  }

                                  return rolesArray.map(rol => (
                                    <div key={rol} className="mb-2 pb-2 border-bottom">
                                      <small className="fw-bold d-block mb-1">{rol}</small>
                                      <div className="d-flex gap-1">
                                        <select
                                          className="form-select form-select-sm"
                                          style={{ fontSize: '10px', padding: '2px', width: '50px' }}
                                          value={honorariosActual.jornales?.porRol?.[rol]?.tipo || 'porcentaje'}
                                          onChange={(e) => setHonorarios(prev => ({
                                            ...prev,
                                            jornales: {
                                              ...prev.jornales,
                                              porRol: {
                                                ...(prev.jornales?.porRol || {}),
                                                [rol]: {
                                                  ...(prev.jornales?.porRol?.[rol] || {}),
                                                  tipo: e.target.value
                                                }
                                              }
                                            }
                                          }))}
                                        >
                                          <option value="porcentaje">%</option>
                                          <option value="fijo">$</option>
                                        </select>
                                        <input
                                          type="number"
                                          className="form-control form-control-sm"
                                          style={{ fontSize: '10px', padding: '2px' }}
                                          placeholder={honorariosActual.jornales?.porRol?.[rol]?.tipo === 'porcentaje' ? '10' : '1000'}
                                          value={honorariosActual.jornales?.porRol?.[rol]?.valor || ''}
                                          onChange={(e) => setHonorarios(prev => ({
                                            ...prev,
                                            jornales: {
                                              ...prev.jornales,
                                              porRol: {
                                                ...(prev.jornales?.porRol || {}),
                                                [rol]: {
                                                  ...(prev.jornales?.porRol?.[rol] || {}),
                                                  valor: e.target.value
                                                }
                                              }
                                            }
                                          }))}
                                        />
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            ) : (
                              <div className="d-flex gap-1 align-items-center">
                                <select
                                  className="form-select form-select-sm"
                                  style={{ fontSize: '10px', padding: '2px' }}
                                  value={honorariosActual.jornales?.tipo || 'porcentaje'}
                                  onChange={(e) => setHonorarios(prev => ({
                                    ...prev,
                                    jornales: { ...prev.jornales, tipo: e.target.value }
                                  }))}
                                >
                                  <option value="porcentaje">%</option>
                                  <option value="fijo">$</option>
                                </select>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  style={{ fontSize: '10px', padding: '2px' }}
                                  placeholder={honorariosActual.jornales?.tipo === 'porcentaje' ? '10' : '1000'}
                                  value={honorariosActual.jornales?.valor || ''}
                                  onChange={(e) => setHonorarios(prev => ({
                                    ...prev,
                                    jornales: { ...prev.jornales, valor: e.target.value }
                                  }))}
                                />
                              </div>
                            )}
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Honorario:</span>
                            <span className="small fw-bold">${resumen.jornales.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${resumen.jornales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Profesionales */}
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div
                            className="d-flex justify-content-between align-items-center"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setColapsadoProfesionalesHonorarios(!colapsadoProfesionalesHonorarios)}
                          >
                            <small className="text-muted d-block">👷 Profesionales</small>
                            <i className={`fas fa-chevron-${colapsadoProfesionalesHonorarios ? 'down' : 'up'}`} style={{ fontSize: '10px' }}></i>
                          </div>
                          {!colapsadoProfesionalesHonorarios && (
                          <>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base:</span>
                            <span className="small fw-bold">${(resumen.profesionales.baseOriginal || resumen.profesionales.base).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Controles individuales para Profesionales */}
                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={honorariosActual.profesionales.tipo}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  profesionales: { ...prev.profesionales, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={honorariosActual.profesionales.tipo === 'porcentaje' ? '10' : '1000'}
                                value={honorariosActual.profesionales.valor}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  profesionales: { ...prev.profesionales, valor: e.target.value }
                                }))}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Honorario:</span>
                            <span className="small fw-bold">${resumen.profesionales.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${resumen.profesionales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          </>
                          )}
                        </div>
                      </div>

                      {/* Materiales */}
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <small className="text-muted d-block">🧱 Materiales</small>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base:</span>
                            <span className="small fw-bold">${(resumen.materiales.baseOriginal || resumen.materiales.base).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Controles individuales para Materiales */}
                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={honorariosActual.materiales.tipo}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  materiales: { ...prev.materiales, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={honorariosActual.materiales.tipo === 'porcentaje' ? '10' : '1000'}
                                value={honorariosActual.materiales.valor}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  materiales: { ...prev.materiales, valor: e.target.value }
                                }))}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Honorario:</span>
                            <span className="small fw-bold">${resumen.materiales.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${resumen.materiales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      {/* 💼 Gastos Generales (UNIFICADO: itemsCalculadora.gastosGenerales + otrosCostos manuales) */}
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <small className="text-muted d-block">💼 Gastos Generales</small>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base:</span>
                            <span className="small fw-bold">${((resumen.gastosGenerales?.baseOriginal || resumen.gastosGenerales?.base || 0) + (resumen.otrosCostos.baseOriginal || resumen.otrosCostos.base)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Controles individuales para Gastos Generales */}
                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={honorariosActual.otrosCostos.tipo}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  otrosCostos: { ...prev.otrosCostos, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={honorariosActual.otrosCostos.tipo === 'porcentaje' ? '10' : '1000'}
                                value={honorariosActual.otrosCostos.valor}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  otrosCostos: { ...prev.otrosCostos, valor: e.target.value }
                                }))}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Honorario:</span>
                            <span className="small fw-bold">${((resumen.gastosGenerales?.honorario || 0) + resumen.otrosCostos.honorario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${((resumen.gastosGenerales?.total || 0) + resumen.otrosCostos.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      {/* 🧮 Tarea con Jornal y Materiales */}
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div
                            className="d-flex justify-content-between align-items-center"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setColapsadoConfigPresupuestoHonorarios(!colapsadoConfigPresupuestoHonorarios)}
                          >
                            <small className="text-muted d-block">🧮 Tarea con Jornal y Materiales</small>
                            <i className={`fas fa-chevron-${colapsadoConfigPresupuestoHonorarios ? 'down' : 'up'}`} style={{ fontSize: '10px' }}></i>
                          </div>
                          {!colapsadoConfigPresupuestoHonorarios && (
                          <>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base:</span>
                            <span className="small fw-bold">${(resumen.configuracionPresupuesto.baseOriginal || resumen.configuracionPresupuesto.base).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Controles individuales para Configuración Presupuesto */}
                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={honorariosActual.configuracionPresupuesto.tipo}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  configuracionPresupuesto: { ...prev.configuracionPresupuesto, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={honorariosActual.configuracionPresupuesto.tipo === 'porcentaje' ? '10' : '1000'}
                                value={honorariosActual.configuracionPresupuesto.valor}
                                onChange={(e) => setHonorarios(prev => ({
                                  ...prev,
                                  configuracionPresupuesto: { ...prev.configuracionPresupuesto, valor: e.target.value }
                                }))}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Honorario:</span>
                            <span className="small fw-bold">${resumen.configuracionPresupuesto.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${resumen.configuracionPresupuesto.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total General */}
                    <div className="border-top pt-3">
                      <div className="row">
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between">
                            <span>Subtotal (sin honorarios):</span>
                            <span className="fw-bold">${resumen.totales.base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between text-success">
                            <span>Total Honorarios:</span>
                            <span className="fw-bold">${resumen.totales.honorarios.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between">
                            <span className="fs-5 fw-bold">TOTAL FINAL:</span>
                            <span className="fs-5 fw-bold text-primary">${resumen.totales.final.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Desglose de ganancia por sección */}
                      <div className="alert alert-success mt-3 mb-0">
                        <strong>💰 Ganancia por sección:</strong>
                        <div className="row mt-2 small">
                          {resumen.jornales.honorario > 0 && (
                            <div className="col-md-3">
                              🏗️ Jornales: <strong>${resumen.jornales.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          {resumen.profesionales.honorario > 0 && (
                            <div className="col-md-3">
                              👷 Profesionales: <strong>${resumen.profesionales.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          {resumen.materiales.honorario > 0 && (
                            <div className="col-md-3">
                              🧱 Materiales: <strong>${resumen.materiales.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          {((resumen.gastosGenerales?.honorario || 0) + resumen.otrosCostos.honorario) > 0 && (
                            <div className="col-md-3">
                              💼 Gastos Generales: <strong>${((resumen.gastosGenerales?.honorario || 0) + resumen.otrosCostos.honorario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          {resumen.configuracionPresupuesto.honorario > 0 && (
                            <div className="col-md-3">
                              🧮 Tarea con Jornal y Materiales: <strong>${resumen.configuracionPresupuesto.honorario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                        </div>
                        <hr className="my-2" />
                        <div className="text-center">
                          <strong className="fs-6">🎯 GANANCIA TOTAL: ${resumen.totales.honorarios.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      </div>

                      {/* Botón para aceptar la configuración */}
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          className={`btn ${configuracionAceptada ? 'btn-secondary' : 'btn-success'} btn-lg`}
                          onClick={() => {
                            if (!configuracionAceptada) {
                              // Guardar valores de configuración para el rubro actual
                              if (rubroActual) {
                                const valoresAGuardar = {
                                  profesionales: {
                                    tipo: honorariosActual.profesionales.tipo,
                                    valor: honorariosActual.profesionales.valor
                                  },
                                  materiales: {
                                    tipo: honorariosActual.materiales.tipo,
                                    valor: honorariosActual.materiales.valor
                                  },
                                  otrosCostos: {
                                    tipo: honorariosActual.otrosCostos.tipo,
                                    valor: honorariosActual.otrosCostos.valor
                                  },
                                  configuracionPresupuesto: {
                                    tipo: honorariosActual.configuracionPresupuesto.tipo,
                                    valor: honorariosActual.configuracionPresupuesto.valor
                                  }
                                };
                                guardarValoresHonorarios(rubroActual, valoresAGuardar);
                              }

                              setConfiguracionAceptada(true);
                              const mensaje = rubroActual
                                ? `Configuración de honorarios para "${rubroActual}" guardada temporalmente. Presione "Guardar" al final para confirmar todos los cambios.`
                                : 'Configuración de honorarios guardada temporalmente. Presione "Guardar" al final para confirmar todos los cambios.';
                              alert(mensaje);
                            }
                          }}
                          disabled={configuracionAceptada}
                        >
                          {configuracionAceptada ? '✓ Configuración Aceptada' : '✅ Aceptar Configuración de Honorarios'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========== SECCIÓN DE MAYORES COSTOS (CLON EXACTO DE HONORARIOS) ========== */}
      {(mostrarSolo === 'ambos' || mostrarSolo === 'mayoresCostos') && !soloLectura && (
        <div className={`mt-3 border rounded p-3 ${ocultarMayoresCostosEnPDF ? 'ocultar-en-pdf' : ''}`} style={{backgroundColor: '#e7f3ff'}}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6
              className="mb-0"
              style={{cursor: 'pointer', fontWeight: 'bold', color: '#0056b3'}}
              onClick={() => {
                setMostrarMayoresCostos(!mostrarMayoresCostos);
                // Si mayoresCostos es null, inicializarlo cuando se abre por primera vez
                if (!mostrarMayoresCostos && !mayoresCostosActual) {
                  setMayoresCostos({
                    valorGeneral: '',
                    tipoGeneral: 'porcentaje',
                    profesionales: { activo: true, tipo: 'porcentaje', valor: '' },
                    materiales: { activo: true, tipo: 'porcentaje', valor: '' },
                    otrosCostos: { activo: true, tipo: 'porcentaje', valor: '' },
                    configuracionPresupuesto: { activo: true, tipo: 'porcentaje', valor: '' }
                  });
                }
              }}
            >
              💰 Configuración de Mayores Costos
              <span className="ms-2 small">{mostrarMayoresCostos ? '▼' : '▶'}</span>
            </h6>

            <div className="form-check form-switch" onClick={(e) => e.stopPropagation()}>
              <input
                className="form-check-input"
                type="checkbox"
                id="ocultarMayoresCostosEnPDF"
                checked={ocultarMayoresCostosEnPDF}
                onChange={(e) => setOcultarMayoresCostosEnPDF(e.target.checked)}
                title="Si está marcado, esta sección NO aparecerá en el PDF"
              />
              <label className="form-check-label small text-muted" htmlFor="ocultarMayoresCostosEnPDF" title="Si está marcado, esta sección NO aparecerá en el PDF">
                🔒 Ocultar en PDF
              </label>
            </div>
          </div>

          {/* Campo de explicación de mayores costos */}
          {mostrarMayoresCostos && (
            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
              <label className="form-label small fw-bold text-muted">
                📝 Explicación / Justificación de Mayores Costos
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                placeholder="Ingrese aquí la explicación o justificación de por qué se aplican mayores costos..."
                value={mayoresCostosActual.explicacion || ''}
                onChange={(e) => setMayoresCostos(prev => ({ ...prev, explicacion: e.target.value }))}
                disabled={soloLectura}
              />
              <small className="form-text text-muted">
                Este texto aparecerá en el PDF explicando al cliente el motivo de los mayores costos aplicados.
              </small>
            </div>
          )}

          {mostrarMayoresCostos && mayoresCostosActual && (
            <div className="border rounded p-3" style={{backgroundColor: '#d7f0f8'}}>
              {/* Solo selector de rubro e importar datos */}
              <div className="d-flex align-items-center mb-3">
                <h6 className="text-primary mb-0 me-3">📊 Importar Datos de Rubro</h6>

                {/* Selector de rubros para importar datos */}
                <select
                  className="form-select form-select-sm me-2"
                  style={{ width: '200px' }}
                  value={rubroMayoresCostosSeleccionado}
                  onChange={(e) => setRubroMayoresCostosSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar rubro...</option>
                  {itemsCalculadora && itemsCalculadora.length > 0 && itemsCalculadora.map((item, index) => (
                    <option key={item.id || index} value={item.id || index}>
                      {item.tipoProfesional || `Rubro ${index + 1}`}
                    </option>
                  ))}
                </select>

                <button
                    type="button"
                    className={`btn btn-sm ${mayoresCostosActual.generalImportado ? 'btn-warning' : 'btn-outline-primary'}`}
                    onClick={() => {
                      if (!mayoresCostosActual.generalImportado) {
                        // 🔥 SOLO IMPORTAR HONORARIOS (no las otras 4 tarjetas)
                        if (rubroMayoresCostosSeleccionado) {
                          const rubroItem = itemsCalculadora.find(item => (item.id || itemsCalculadora.indexOf(item)) == rubroMayoresCostosSeleccionado);
                          if (rubroItem) {
                            // 🎯 Solo importar configuración de honorarios del form principal
                            const honorariosDelForm = honorarios || {};

                            setMayoresCostos(prev => ({
                              ...prev,
                              generalImportado: true,
                              rubroImportado: rubroMayoresCostosSeleccionado,
                              nombreRubroImportado: rubroItem.tipoProfesional,
                              // 🔥 SOLO activar y llenar la tarjeta de HONORARIOS
                              honorarios: {
                                activo: true,
                                tipo: 'porcentaje',
                                valor: honorariosDelForm.valorGeneral || honorariosDelForm.profesionales?.valor || '10'
                              },
                              // Las demás tarjetas quedan DESACTIVADAS
                              profesionales: { ...prev.profesionales, activo: false, valor: '' },
                              materiales: { ...prev.materiales, activo: false, valor: '' },
                              otrosCostos: { ...prev.otrosCostos, activo: false, valor: '' },
                              configuracionPresupuesto: { ...prev.configuracionPresupuesto, activo: false, valor: '' }
                            }));

                            console.log('📊 Honorarios importados del presupuesto:', honorariosDelForm);
                          } else {
                            alert('⚠️ No se encontró el rubro seleccionado');
                          }
                        } else {
                          alert('⚠️ Debe seleccionar un rubro primero');
                        }
                      } else {
                        // Desactivar todo
                        setMayoresCostos(prev => ({
                          ...prev,
                          generalImportado: false,
                          rubroImportado: null,
                          nombreRubroImportado: null,
                          profesionales: { ...prev.profesionales, activo: false, valor: '' },
                          materiales: { ...prev.materiales, activo: false, valor: '' },
                          otrosCostos: { ...prev.otrosCostos, activo: false, valor: '' },
                          configuracionPresupuesto: { ...prev.configuracionPresupuesto, activo: false, valor: '' },
                          honorarios: { ...prev.honorarios, activo: false, valor: '' }
                        }));
                        setRubroMayoresCostosSeleccionado('');
                      }
                    }}
                    disabled={!mayoresCostosActual.generalImportado && !rubroMayoresCostosSeleccionado}
                    >
                    <i className={`fas ${mayoresCostosActual.generalImportado ? 'fa-undo' : 'fa-download'} me-1`}></i>
                    {mayoresCostosActual.generalImportado ? 'Quitar datos' : 'Importar datos'}
                  </button>
              </div>

              {/* Resumen de Mayores Costos - COPIA EXACTA DE HONORARIOS */}
              {(() => {
                const resumen = calcularResumenHonorarios(null, mayoresCostosActual);
                const hayValores = resumen.totales.base > 0 || resumen.totales.honorarios > 0;

                return hayValores && (
                  <div className="mt-4 border rounded p-3 bg-white">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="text-success mb-0">
                        📊 Resumen de Mayores Costos
                        {resumen.rubroEspecifico && (
                          <span className="ms-2 badge bg-info text-white">
                            Rubro: {resumen.rubroEspecifico}
                          </span>
                        )}
                      </h6>

                      {/* ✨ Switch para aplicar mismo % a todos los items */}
                      <div className="d-flex align-items-center gap-2">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="switchGlobalMayoresCostos"
                            checked={aplicarGlobalMayoresCostos}
                            onChange={(e) => setAplicarGlobalMayoresCostos(e.target.checked)}
                          />
                          <label className="form-check-label small fw-bold text-muted" htmlFor="switchGlobalMayoresCostos">
                            Asignar el mismo % a todos los items
                          </label>
                        </div>

                        {/* Input global - solo visible si el switch está activado */}
                        {aplicarGlobalMayoresCostos && (
                          <div className="d-flex gap-1 align-items-center" style={{minWidth: '150px'}}>
                            <select
                              className="form-select form-select-sm"
                              style={{fontSize: '10px', padding: '4px', width: '60px'}}
                              value={tipoGlobalMayoresCostos}
                              onChange={(e) => setTipoGlobalMayoresCostos(e.target.value)}
                            >
                              <option value="porcentaje">%</option>
                              <option value="fijo">$</option>
                            </select>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="Valor"
                              value={valorGlobalMayoresCostos}
                              onChange={(e) => {
                                const valor = e.target.value;
                                setValorGlobalMayoresCostos(valor);

                                // Aplicar automáticamente a todos los items
                                if (valor && onMayoresCostosChange) {
                                  const nuevoMayoresCostos = {
                                    ...mayoresCostosActual,
                                    jornales: { ...mayoresCostosActual.jornales, tipo: tipoGlobalMayoresCostos, valor: valor },
                                    profesionales: { ...mayoresCostosActual.profesionales, tipo: tipoGlobalMayoresCostos, valor: valor },
                                    materiales: { ...mayoresCostosActual.materiales, tipo: tipoGlobalMayoresCostos, valor: valor },
                                    otrosCostos: { ...mayoresCostosActual.otrosCostos, tipo: tipoGlobalMayoresCostos, valor: valor },
                                    configuracionPresupuesto: { ...mayoresCostosActual.configuracionPresupuesto, tipo: tipoGlobalMayoresCostos, valor: valor },
                                    honorarios: { ...mayoresCostosActual.honorarios, tipo: tipoGlobalMayoresCostos, valor: valor }
                                  };
                                  onMayoresCostosChange(nuevoMayoresCostos);
                                }
                              }}
                              style={{fontSize: '11px', padding: '4px', width: '80px'}}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      {/* Jornales */}
                      {resumen.jornales && (resumen.jornales.baseOriginal > 0 || resumen.jornales.base > 0) && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">🏗️ Jornales</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={mayoresCostosActual.jornales?.activo !== false}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  jornales: { ...prev.jornales, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${(resumen.jornales.baseOriginal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Selector de modo: Aplicar a todos o por rol */}
                          <div className="mt-2 mb-2">
                            <select
                              className="form-select form-select-sm mb-2"
                              style={{ fontSize: '11px' }}
                              value={mayoresCostosActual.jornales?.modoAplicacion || 'todos'}
                              onChange={(e) => {
                                const nuevoModo = e.target.value;
                                setMayoresCostos(prev => ({
                                  ...prev,
                                  jornales: {
                                    ...prev.jornales,
                                    modoAplicacion: nuevoModo,
                                    porRol: nuevoModo === 'todos' ? {} : (prev.jornales?.porRol || {})
                                  }
                                }));
                              }}
                            >
                              <option value="todos">✓ Aplicar a TODOS los roles</option>
                              <option value="porRol">⚙️ Configurar POR ROL</option>
                            </select>

                            {/* Controles según el modo */}
                            {mayoresCostosActual.jornales?.modoAplicacion === 'porRol' ? (
                              <div className="border rounded p-2 bg-white" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {(() => {
                                  // Obtener roles únicos de jornales
                                  const rolesUnicos = new Set();
                                  if (itemsCalculadora && Array.isArray(itemsCalculadora)) {
                                    itemsCalculadora.forEach(item => {
                                      if (item.jornales && Array.isArray(item.jornales)) {
                                        item.jornales.forEach(jornal => {
                                          if (jornal.rol) rolesUnicos.add(jornal.rol);
                                        });
                                      }
                                    });
                                  }

                                  const rolesArray = Array.from(rolesUnicos);

                                  if (rolesArray.length === 0) {
                                    return <small className="text-muted fst-italic">No hay roles de jornales</small>;
                                  }

                                  return rolesArray.map(rol => (
                                    <div key={rol} className="mb-2 pb-2 border-bottom">
                                      <small className="fw-bold d-block mb-1">{rol}</small>
                                      <div className="d-flex gap-1">
                                        <select
                                          className="form-select form-select-sm"
                                          style={{ fontSize: '10px', padding: '2px', width: '50px' }}
                                          value={mayoresCostosActual.jornales?.porRol?.[rol]?.tipo || 'porcentaje'}
                                          onChange={(e) => setMayoresCostos(prev => ({
                                            ...prev,
                                            jornales: {
                                              ...prev.jornales,
                                              porRol: {
                                                ...(prev.jornales?.porRol || {}),
                                                [rol]: {
                                                  ...(prev.jornales?.porRol?.[rol] || {}),
                                                  tipo: e.target.value
                                                }
                                              }
                                            }
                                          }))}
                                        >
                                          <option value="porcentaje">%</option>
                                          <option value="fijo">$</option>
                                        </select>
                                        <input
                                          type="number"
                                          className="form-control form-control-sm"
                                          style={{ fontSize: '10px', padding: '2px' }}
                                          placeholder={mayoresCostosActual.jornales?.porRol?.[rol]?.tipo === 'porcentaje' ? '10' : '1000'}
                                          value={mayoresCostosActual.jornales?.porRol?.[rol]?.valor || ''}
                                          onChange={(e) => setMayoresCostos(prev => ({
                                            ...prev,
                                            jornales: {
                                              ...prev.jornales,
                                              porRol: {
                                                ...(prev.jornales?.porRol || {}),
                                                [rol]: {
                                                  ...(prev.jornales?.porRol?.[rol] || {}),
                                                  valor: e.target.value
                                                }
                                              }
                                            }
                                          }))}
                                        />
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            ) : (
                              <div className="d-flex gap-1 align-items-center">
                                <select
                                  className="form-select form-select-sm"
                                  style={{ fontSize: '10px', padding: '2px' }}
                                  value={mayoresCostosActual.jornales?.tipo || 'porcentaje'}
                                  onChange={(e) => setMayoresCostos(prev => ({
                                    ...prev,
                                    jornales: { ...prev.jornales, tipo: e.target.value }
                                  }))}
                                >
                                  <option value="porcentaje">%</option>
                                  <option value="fijo">$</option>
                                </select>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  style={{ fontSize: '10px', padding: '2px' }}
                                  placeholder={mayoresCostosActual.jornales?.tipo === 'porcentaje' ? '10' : '1000'}
                                  value={mayoresCostosActual.jornales?.valor || ''}
                                  onChange={(e) => {
                                    setMayoresCostos(prev => ({
                                      ...prev,
                                      jornales: { ...prev.jornales, valor: e.target.value }
                                    }));
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Mayor Costo:</span>
                            <span className="small fw-bold">${(() => {
                              // Si está explícitamente desactivado, retornar 0
                              if (mayoresCostosActual.jornales?.activo === false) return '0,00';

                              const base = resumen.jornales.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.jornales?.valor || 0);

                              // Si no hay valor configurado, retornar 0
                              if (valor === 0) return '0,00';

                              // Calcular según tipo
                              if (mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = resumen.jornales.baseOriginal || 0;

                              // Si está explícitamente desactivado, solo retornar la base
                              if (mayoresCostosActual.jornales?.activo === false) {
                                return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }

                              const valor = Number(mayoresCostosActual.jornales?.valor || 0);
                              let mayorCosto = 0;

                              // Calcular mayor costo según tipo
                              if (valor > 0) {
                                if (mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  mayorCosto = (base * valor) / 100;
                                } else {
                                  mayorCosto = valor;
                                }
                              }

                              return (base + mayorCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Profesionales */}
                      {resumen.profesionales && (resumen.profesionales.baseOriginal > 0 || resumen.profesionales.base > 0) && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div
                            className="d-flex justify-content-between align-items-center mb-2"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setColapsadoProfesionalesMayoresCostos(!colapsadoProfesionalesMayoresCostos)}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <small className="text-muted">👷 Profesionales</small>
                              <i className={`fas fa-chevron-${colapsadoProfesionalesMayoresCostos ? 'down' : 'up'}`} style={{ fontSize: '10px' }}></i>
                            </div>
                            <div className="form-check form-check-sm" onClick={(e) => e.stopPropagation()}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={mayoresCostosActual.profesionales?.activo !== false}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  profesionales: { ...prev.profesionales, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          {!colapsadoProfesionalesMayoresCostos && (
                          <>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${(resumen.profesionales.baseOriginal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={mayoresCostosActual.profesionales.tipo}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  profesionales: { ...prev.profesionales, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={mayoresCostosActual.profesionales.tipo === 'porcentaje' ? '10' : '1000'}
                                value={mayoresCostosActual.profesionales.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setMayoresCostos(prev => ({
                                    ...prev,
                                    profesionales: {
                                      ...prev.profesionales,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Mayor Costo:</span>
                            <span className="small fw-bold">${(() => {
                              if (mayoresCostosActual.profesionales?.activo === false) return '0,00';
                              const base = resumen.profesionales.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.profesionales?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = resumen.profesionales.baseOriginal || 0;
                              if (mayoresCostosActual.profesionales?.activo === false) return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              const valor = Number(mayoresCostosActual.profesionales?.valor || 0);
                              let mayorCosto = 0;
                              if (valor > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                mayorCosto = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCosto = valor;
                              }
                              return (base + mayorCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                          </>
                          )}
                        </div>
                      </div>
                      )}

                      {/* Materiales */}
                      {resumen.materiales && (resumen.materiales.baseOriginal > 0 || resumen.materiales.base > 0) && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">🧱 Materiales</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={mayoresCostosActual.materiales?.activo !== false}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  materiales: { ...prev.materiales, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${(resumen.materiales.baseOriginal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={mayoresCostosActual.materiales.tipo}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  materiales: { ...prev.materiales, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={mayoresCostosActual.materiales.tipo === 'porcentaje' ? '10' : '1000'}
                                value={mayoresCostosActual.materiales.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setMayoresCostos(prev => ({
                                    ...prev,
                                    materiales: {
                                      ...prev.materiales,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Mayor Costo:</span>
                            <span className="small fw-bold">${(() => {
                              if (mayoresCostosActual.materiales?.activo === false) return '0,00';
                              const base = resumen.materiales.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.materiales?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = resumen.materiales.baseOriginal || 0;
                              if (mayoresCostosActual.materiales?.activo === false) return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              const valor = Number(mayoresCostosActual.materiales?.valor || 0);
                              let mayorCosto = 0;
                              if (valor > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                mayorCosto = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCosto = valor;
                              }
                              return (base + mayorCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Gastos Generales */}
                      {(resumen.gastosGenerales || resumen.otrosCostos) && ((resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos.baseOriginal || 0) > 0) && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">💼 Gastos Generales</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={mayoresCostosActual.otrosCostos?.activo !== false}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  otrosCostos: { ...prev.otrosCostos, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${((resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos.baseOriginal || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={mayoresCostosActual.otrosCostos.tipo}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  otrosCostos: { ...prev.otrosCostos, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={mayoresCostosActual.otrosCostos.tipo === 'porcentaje' ? '10' : '1000'}
                                value={mayoresCostosActual.otrosCostos.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setMayoresCostos(prev => ({
                                    ...prev,
                                    otrosCostos: {
                                      ...prev.otrosCostos,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Mayor Costo:</span>
                            <span className="small fw-bold">${(() => {
                              if (mayoresCostosActual.otrosCostos?.activo === false) return '0,00';
                              const base = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos.baseOriginal || 0);
                              const valor = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos.baseOriginal || 0);
                              if (mayoresCostosActual.otrosCostos?.activo === false) return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              const valor = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                              let mayorCosto = 0;
                              if (valor > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                mayorCosto = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCosto = valor;
                              }
                              return (base + mayorCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Tarea con Jornal y Materiales */}
                      {resumen.configuracionPresupuesto && (resumen.configuracionPresupuesto.baseOriginal > 0 || resumen.configuracionPresupuesto.base > 0) && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div
                            className="d-flex justify-content-between align-items-center mb-2"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setColapsadoConfigPresupuestoMayoresCostos(!colapsadoConfigPresupuestoMayoresCostos)}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <small className="text-muted">🧮 Tarea con Jornal y Materiales</small>
                              <i className={`fas fa-chevron-${colapsadoConfigPresupuestoMayoresCostos ? 'down' : 'up'}`} style={{ fontSize: '10px' }}></i>
                            </div>
                            <div className="form-check form-check-sm" onClick={(e) => e.stopPropagation()}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={mayoresCostosActual.configuracionPresupuesto?.activo !== false}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  configuracionPresupuesto: { ...prev.configuracionPresupuesto, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          {!colapsadoConfigPresupuestoMayoresCostos && (
                          <>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${(resumen.configuracionPresupuesto.baseOriginal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={mayoresCostosActual.configuracionPresupuesto.tipo}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  configuracionPresupuesto: { ...prev.configuracionPresupuesto, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={mayoresCostosActual.configuracionPresupuesto.tipo === 'porcentaje' ? '10' : '1000'}
                                value={mayoresCostosActual.configuracionPresupuesto.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setMayoresCostos(prev => ({
                                    ...prev,
                                    configuracionPresupuesto: {
                                      ...prev.configuracionPresupuesto,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Mayor Costo:</span>
                            <span className="small fw-bold">${(() => {
                              if (mayoresCostosActual.configuracionPresupuesto?.activo === false) return '0,00';
                              const base = resumen.configuracionPresupuesto.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = resumen.configuracionPresupuesto.baseOriginal || 0;
                              if (mayoresCostosActual.configuracionPresupuesto?.activo === false) return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              const valor = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                              let mayorCosto = 0;
                              if (valor > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                mayorCosto = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCosto = valor;
                              }
                              return (base + mayorCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                          </>
                          )}
                        </div>
                      </div>
                      )}

                      {/* Honorarios */}
                      {resumen.honorarios && resumen.honorarios.base > 0 && (
                      <div className="col-md-4">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">💰 Honorarios (total)</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={mayoresCostosActual.honorarios?.activo !== false}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  honorarios: { ...prev.honorarios, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base:</span>
                            <span className="small fw-bold">${(resumen.honorarios?.base || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={mayoresCostosActual.honorarios.tipo}
                                onChange={(e) => setMayoresCostos(prev => ({
                                  ...prev,
                                  honorarios: { ...prev.honorarios, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={mayoresCostosActual.honorarios.tipo === 'porcentaje' ? '10' : '1000'}
                                value={mayoresCostosActual.honorarios.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setMayoresCostos(prev => ({
                                    ...prev,
                                    honorarios: {
                                      ...prev.honorarios,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-success">
                            <span className="small">+ Mayor Costo:</span>
                            <span className="small fw-bold">${(() => {
                              if (mayoresCostosActual.honorarios?.activo === false) return '0,00';
                              const base = resumen.honorarios?.base || 0;
                              const valor = Number(mayoresCostosActual.honorarios?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              if (mayoresCostosActual.honorarios?.activo === false) {
                                return (resumen.honorarios?.base || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              const base = resumen.honorarios?.base || 0;
                              const valor = Number(mayoresCostosActual.honorarios?.valor || 0);
                              let mayorCosto = 0;
                              if (valor > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                mayorCosto = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCosto = valor;
                              }
                              return (base + mayorCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>

                    {/* Total General */}
                    <div className="border-top pt-3">
                      <div className="row">
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between">
                            <span>Subtotal (sin mayores costos):</span>
                            <span className="fw-bold">${(() => {
                              // Subtotal = TODAS las bases sin mayores costos
                              const baseJornales = resumen.jornales?.baseOriginal || 0;
                              const baseProfesionales = resumen.profesionales?.baseOriginal || 0;
                              const baseMateriales = resumen.materiales?.baseOriginal || 0;
                              const baseOtrosCostos = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                              const baseConfiguracion = resumen.configuracionPresupuesto?.baseOriginal || 0;
                              const baseHonorarios = resumen.honorarios?.base || 0;

                              return (baseJornales + baseProfesionales + baseMateriales + baseOtrosCostos + baseConfiguracion + baseHonorarios).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between text-success">
                            <span>Total Mayores Costos:</span>
                            <span className="fw-bold">${(() => {
                              // Calcular total de mayores costos directamente respetando checkboxes
                              let total = 0;

                              // Jornales
                              if (mayoresCostosActual.jornales?.activo !== false) {
                                const baseJornales = resumen.jornales?.baseOriginal || 0;
                                const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  total += (baseJornales * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  total += valorJornales;
                                }
                              }

                              // Profesionales
                              if (mayoresCostosActual.profesionales?.activo !== false) {
                                const baseProf = resumen.profesionales?.baseOriginal || 0;
                                const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                  total += (baseProf * valorProf) / 100;
                                } else if (valorProf > 0) {
                                  total += valorProf;
                                }
                              }

                              // Materiales
                              if (mayoresCostosActual.materiales?.activo !== false) {
                                const baseMat = resumen.materiales?.baseOriginal || 0;
                                const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                  total += (baseMat * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  total += valorMat;
                                }
                              }

                              // Otros Costos / Gastos Generales
                              if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                                const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                  total += (baseOtros * valorOtros) / 100;
                                } else if (valorOtros > 0) {
                                  total += valorOtros;
                                }
                              }

                              // Configuración Presupuesto
                              if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                const baseConfig = resumen.configuracionPresupuesto?.baseOriginal || 0;
                                const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                  total += (baseConfig * valorConfig) / 100;
                                } else if (valorConfig > 0) {
                                  total += valorConfig;
                                }
                              }

                              // Honorarios
                              if (mayoresCostosActual.honorarios?.activo !== false) {
                                const baseHon = resumen.honorarios?.base || 0;
                                const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                  total += (baseHon * valorHon) / 100;
                                } else if (valorHon > 0) {
                                  total += valorHon;
                                }
                              }

                              return total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between">
                            <span className="fs-5 fw-bold">TOTAL FINAL:</span>
                            <span className="fs-5 fw-bold text-primary">${(() => {
                              // Calcular total final: subtotal + total mayores costos
                              const baseJornales = resumen.jornales?.baseOriginal || 0;
                              const baseProfesionales = resumen.profesionales?.baseOriginal || 0;
                              const baseMateriales = resumen.materiales?.baseOriginal || 0;
                              const baseOtrosCostos = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                              const baseConfiguracion = resumen.configuracionPresupuesto?.baseOriginal || 0;
                              const baseHonorarios = resumen.honorarios?.base || 0;

                              const subtotal = baseJornales + baseProfesionales + baseMateriales + baseOtrosCostos + baseConfiguracion + baseHonorarios;

                              let totalMayoresCostos = 0;

                              // Jornales
                              if (mayoresCostosActual.jornales?.activo !== false) {
                                const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseJornales * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  totalMayoresCostos += valorJornales;
                                }
                              }

                              // Profesionales
                              if (mayoresCostosActual.profesionales?.activo !== false) {
                                const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseProfesionales * valorProf) / 100;
                                } else if (valorProf > 0) {
                                  totalMayoresCostos += valorProf;
                                }
                              }

                              // Materiales
                              if (mayoresCostosActual.materiales?.activo !== false) {
                                const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseMateriales * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  totalMayoresCostos += valorMat;
                                }
                              }

                              // Otros Costos
                              if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseOtrosCostos * valorOtros) / 100;
                                } else if (valorOtros > 0) {
                                  totalMayoresCostos += valorOtros;
                                }
                              }

                              // Configuración Presupuesto
                              if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseConfiguracion * valorConfig) / 100;
                                } else if (valorConfig > 0) {
                                  totalMayoresCostos += valorConfig;
                                }
                              }

                              // Honorarios
                              if (mayoresCostosActual.honorarios?.activo !== false) {
                                const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseHonorarios * valorHon) / 100;
                                } else if (valorHon > 0) {
                                  totalMayoresCostos += valorHon;
                                }
                              }

                              return (subtotal + totalMayoresCostos).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Desglose por sección */}
                      <div className="alert alert-warning mt-3 mb-0">
                        <strong>💰 Mayores Costos por sección:</strong>
                        <div className="row mt-2 small">
                          {(() => {
                            // Calcular mayor costo de jornales
                            let mayorCostoJornales = 0;
                            if (mayoresCostosActual.jornales?.activo !== false) {
                              const base = resumen.jornales?.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.jornales?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                mayorCostoJornales = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCostoJornales = valor;
                              }
                            }
                            return mayorCostoJornales > 0 && (
                              <div className="col-md-3">
                                🏗️ Jornales: <strong>${mayorCostoJornales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular mayor costo de profesionales
                            let mayorCostoProf = 0;
                            if (mayoresCostosActual.profesionales?.activo !== false) {
                              const base = resumen.profesionales?.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.profesionales?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                mayorCostoProf = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCostoProf = valor;
                              }
                            }
                            return mayorCostoProf > 0 && (
                              <div className="col-md-3">
                                👷 Profesionales: <strong>${mayorCostoProf.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular mayor costo de materiales
                            let mayorCostoMat = 0;
                            if (mayoresCostosActual.materiales?.activo !== false) {
                              const base = resumen.materiales?.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.materiales?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                mayorCostoMat = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCostoMat = valor;
                              }
                            }
                            return mayorCostoMat > 0 && (
                              <div className="col-md-3">
                                🧱 Materiales: <strong>${mayorCostoMat.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular mayor costo de gastos generales
                            let mayorCostoOtros = 0;
                            if (mayoresCostosActual.otrosCostos?.activo !== false) {
                              const base = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                              const valor = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                mayorCostoOtros = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCostoOtros = valor;
                              }
                            }
                            return mayorCostoOtros > 0 && (
                              <div className="col-md-3">
                                💼 Gastos Generales: <strong>${mayorCostoOtros.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular mayor costo de configuración
                            let mayorCostoConfig = 0;
                            if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                              const base = resumen.configuracionPresupuesto?.baseOriginal || 0;
                              const valor = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                mayorCostoConfig = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCostoConfig = valor;
                              }
                            }
                            return mayorCostoConfig > 0 && (
                              <div className="col-md-3">
                                🧮 Tarea con Jornal y Materiales: <strong>${mayorCostoConfig.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular mayor costo de honorarios
                            let mayorCostoHon = 0;
                            if (mayoresCostosActual.honorarios?.activo !== false) {
                              const base = resumen.totales.honorarios || 0;
                              const valor = Number(mayoresCostosActual.honorarios?.valor || 0);
                              if (valor > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                mayorCostoHon = (base * valor) / 100;
                              } else if (valor > 0) {
                                mayorCostoHon = valor;
                              }
                            }
                            return mayorCostoHon > 0 && (
                              <div className="col-md-3">
                                💰 Honorarios: <strong>${mayorCostoHon.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                        </div>
                        <hr className="my-2" />
                        <div className="text-center">
                          <strong className="fs-6">🎯 TOTAL MAYORES COSTOS: ${(() => {
                            let total = 0;

                            // Jornales
                            if (mayoresCostosActual.jornales?.activo !== false) {
                              const baseJornales = resumen.jornales?.baseOriginal || 0;
                              const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                              if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                total += (baseJornales * valorJornales) / 100;
                              } else if (valorJornales > 0) {
                                total += valorJornales;
                              }
                            }

                            // Profesionales
                            if (mayoresCostosActual.profesionales?.activo !== false) {
                              const baseProf = resumen.profesionales?.baseOriginal || 0;
                              const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                              if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                total += (baseProf * valorProf) / 100;
                              } else if (valorProf > 0) {
                                total += valorProf;
                              }
                            }

                            // Materiales
                            if (mayoresCostosActual.materiales?.activo !== false) {
                              const baseMat = resumen.materiales?.baseOriginal || 0;
                              const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                              if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                total += (baseMat * valorMat) / 100;
                              } else if (valorMat > 0) {
                                total += valorMat;
                              }
                            }

                            // Otros Costos
                            if (mayoresCostosActual.otrosCostos?.activo !== false) {
                              const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                              const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                              if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                total += (baseOtros * valorOtros) / 100;
                              } else if (valorOtros > 0) {
                                total += valorOtros;
                              }
                            }

                            // Configuración
                            if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                              const baseConfig = resumen.configuracionPresupuesto?.baseOriginal || 0;
                              const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                              if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                total += (baseConfig * valorConfig) / 100;
                              } else if (valorConfig > 0) {
                                total += valorConfig;
                              }
                            }

                            // Honorarios
                            if (mayoresCostosActual.honorarios?.activo !== false) {
                              const baseHon = resumen.honorarios?.base || 0;
                              const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                              if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                total += (baseHon * valorHon) / 100;
                              } else if (valorHon > 0) {
                                total += valorHon;
                              }
                            }

                            return total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                          })()}</strong>
                        </div>
                      </div>

                      {/* Botón para aceptar la configuración */}
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          className={`btn ${configuracionMayoresCostosAceptada ? 'btn-secondary' : 'btn-success'} btn-lg`}
                          onClick={() => {
                            if (!configuracionMayoresCostosAceptada) {
                              // Guardar valores de configuración para el rubro actual
                              if (mayoresCostosActual.nombreRubroImportado) {
                                const valoresAGuardar = {
                                  profesionales: {
                                    tipo: mayoresCostosActual.profesionales.tipo,
                                    valor: mayoresCostosActual.profesionales.valor
                                  },
                                  materiales: {
                                    tipo: mayoresCostosActual.materiales.tipo,
                                    valor: mayoresCostosActual.materiales.valor
                                  },
                                  otrosCostos: {
                                    tipo: mayoresCostosActual.otrosCostos.tipo,
                                    valor: mayoresCostosActual.otrosCostos.valor
                                  },
                                  configuracionPresupuesto: {
                                    tipo: mayoresCostosActual.configuracionPresupuesto.tipo,
                                    valor: mayoresCostosActual.configuracionPresupuesto.valor
                                  },
                                  honorarios: {
                                    tipo: mayoresCostosActual.honorarios.tipo,
                                    valor: mayoresCostosActual.honorarios.valor
                                  }
                                };
                                guardarValoresMayoresCostos(mayoresCostosActual.nombreRubroImportado, valoresAGuardar);
                              }

                              setConfiguracionMayoresCostosAceptada(true);
                              const mensaje = mayoresCostosActual.nombreRubroImportado
                                ? `Configuración de mayores costos para "${mayoresCostosActual.nombreRubroImportado}" guardada temporalmente. Presione "Guardar" al final para confirmar todos los cambios.`
                                : 'Configuración de mayores costos guardada temporalmente. Presione "Guardar" al final para confirmar todos los cambios.';
                              alert(mensaje);
                            }
                          }}
                          disabled={configuracionMayoresCostosAceptada}
                        >
                          {configuracionMayoresCostosAceptada ? '✓ Configuración Aceptada' : '✅ Aceptar Configuración de Mayores Costos'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========== SECCIÓN DE DESCUENTOS (RESTA EN LUGAR DE SUMAR) ========== */}
      {(mostrarSolo === 'ambos' || mostrarSolo === 'descuentos') && !soloLectura && (
        <div className={`mt-3 border rounded p-3 ${ocultarDescuentosEnPDF ? 'ocultar-en-pdf' : ''}`} style={{backgroundColor: '#ffe7f3'}}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6
              className="mb-0"
              style={{cursor: 'pointer', fontWeight: 'bold', color: '#b30056'}}
              onClick={() => {
                setMostrarDescuentos(!mostrarDescuentos);
                // Si descuentos es null, inicializarlo cuando se abre por primera vez
                if (!mostrarDescuentos && !descuentosActual) {
                  setDescuentos({
                    jornales: { activo: true, tipo: 'porcentaje', valor: '' },
                    materiales: { activo: true, tipo: 'porcentaje', valor: '' },
                    honorarios: { activo: true, tipo: 'porcentaje', valor: '' },
                    mayoresCostos: { activo: true, tipo: 'porcentaje', valor: '' }
                  });
                }
              }}
            >
              💸 Configuración de Descuentos
              <span className="ms-2 small">{mostrarDescuentos ? '▼' : '▶'}</span>
            </h6>

            <div className="form-check form-switch" onClick={(e) => e.stopPropagation()}>
              <input
                className="form-check-input"
                type="checkbox"
                id="ocultarDescuentosEnPDF"
                checked={ocultarDescuentosEnPDF}
                onChange={(e) => setOcultarDescuentosEnPDF(e.target.checked)}
                title="Si está marcado, esta sección NO aparecerá en el PDF"
              />
              <label className="form-check-label small text-muted" htmlFor="ocultarDescuentosEnPDF" title="Si está marcado, esta sección NO aparecerá en el PDF">
                🔒 Ocultar en PDF
              </label>
            </div>
          </div>

          {/* Campo de explicación de descuentos */}
          {mostrarDescuentos && (
            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
              <label className="form-label small fw-bold text-muted">
                📝 Explicación / Justificación de Descuentos
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                placeholder="Ingrese aquí la explicación o justificación de por qué se aplican descuentos..."
                value={descuentosActual.explicacion || ''}
                onChange={(e) => setDescuentos(prev => ({ ...prev, explicacion: e.target.value }))}
                disabled={soloLectura}
              />
              <small className="form-text text-muted">
                Este texto aparecerá en el PDF explicando al cliente el motivo de los descuentos aplicados.
              </small>
            </div>
          )}

          {mostrarDescuentos && descuentosActual && (
            <div className="border rounded p-3" style={{backgroundColor: '#ffd7e8'}}>
              {/* Resumen de Descuentos */}
              {(() => {
                // Para descuentos, calcular resumen con honorarios normales (sin aplicar mayores costos)
                const resumen = calcularResumenHonorarios();
                const hayValores = resumen.totales.base > 0 || resumen.totales.honorarios > 0;

                return hayValores && (
                  <div className="mt-4 border rounded p-3 bg-white">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="text-danger mb-0">
                        📊 Resumen de Descuentos
                      </h6>

                      {/* ✨ Switch para aplicar mismo % a todos los items */}
                      <div className="d-flex align-items-center gap-2">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="switchGlobalDescuentos"
                            checked={aplicarGlobalDescuentos}
                            onChange={(e) => setAplicarGlobalDescuentos(e.target.checked)}
                          />
                          <label className="form-check-label small fw-bold text-muted" htmlFor="switchGlobalDescuentos">
                            Asignar el mismo % a todos los items
                          </label>
                        </div>

                        {/* Input global - solo visible si el switch está activado */}
                        {aplicarGlobalDescuentos && (
                          <div className="d-flex gap-1 align-items-center" style={{minWidth: '150px'}}>
                            <select
                              className="form-select form-select-sm"
                              style={{fontSize: '10px', padding: '4px', width: '60px'}}
                              value={tipoGlobalDescuentos}
                              onChange={(e) => setTipoGlobalDescuentos(e.target.value)}
                            >
                              <option value="porcentaje">%</option>
                              <option value="fijo">$</option>
                            </select>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="Valor"
                              value={valorGlobalDescuentos}
                              onChange={(e) => {
                                const valor = e.target.value;
                                setValorGlobalDescuentos(valor);

                                // Aplicar automáticamente a todos los items
                                if (valor && onDescuentosChange) {
                                  const nuevoDescuentos = {
                                    ...descuentosActual,
                                    jornales: { ...descuentosActual.jornales, tipo: tipoGlobalDescuentos, valor: valor },
                                    materiales: { ...descuentosActual.materiales, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorariosJornales: { ...descuentosActual.honorariosJornales, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorariosProfesionales: { ...descuentosActual.honorariosProfesionales, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorariosMateriales: { ...descuentosActual.honorariosMateriales, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorariosOtros: { ...descuentosActual.honorariosOtros, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorariosGastosGenerales: { ...descuentosActual.honorariosGastosGenerales, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorariosConfiguracion: { ...descuentosActual.honorariosConfiguracion, tipo: tipoGlobalDescuentos, valor: valor },
                                    honorarios: { ...descuentosActual.honorarios, tipo: tipoGlobalDescuentos, valor: valor },
                                    mayoresCostos: { ...descuentosActual.mayoresCostos, tipo: tipoGlobalDescuentos, valor: valor }
                                  };
                                  onDescuentosChange(nuevoDescuentos);
                                }
                              }}
                              style={{fontSize: '11px', padding: '4px', width: '80px'}}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ===== FILA 1: DESCUENTOS SOBRE HONORARIOS (por tipo individual) ===== */}
                    {(()=>{
                      const baseOtrosGG = resumen.otrosCostos?.honorario || resumen.gastosGenerales?.honorario || 0;
                      return [
                        { key: 'honorariosJornales', base: resumen.jornales?.honorario || 0 },
                        { key: 'honorariosProfesionales', base: resumen.profesionales?.honorario || 0 },
                        { key: 'honorariosMateriales', base: resumen.materiales?.honorario || 0 },
                        { key: 'honorariosGastosGenerales', base: baseOtrosGG },
                        { key: 'honorariosConfiguracion', base: resumen.configuracionPresupuesto?.honorario || 0 }
                      ];
                    })().some(item => item.base > 0) && (
                      <>
                        <div className="d-flex align-items-center gap-2 mb-2 mt-1 px-2 py-1 rounded" style={{backgroundColor:'#fff3cd', border:'1px solid #ffd54f'}}>
                          <span style={{color:'#e65100', fontWeight:'bold', fontSize:'13px'}}>💰 Descuentos sobre Honorarios</span>
                          <small className="text-muted">(checkbox activos por defecto — ingresá el % o $ a descontar)</small>
                        </div>
                        <div className="row g-3 mb-2">
                          {(()=>{
                            const baseOtrosGG = resumen.otrosCostos?.honorario || resumen.gastosGenerales?.honorario || 0;
                            // Mostrar solo UNA tarjeta para otrosCostos/gastosGenerales (son lo mismo)
                            // Preferir la key que ya tenga valor configurado, sino honorariosGastosGenerales
                            const keyOtros = Number(descuentosActual.honorariosOtros?.valor || 0) > 0
                              ? 'honorariosOtros'
                              : 'honorariosGastosGenerales';
                            return [
                              { key: 'honorariosJornales', label: '💰 Hon. Jornales', base: resumen.jornales?.honorario || 0 },
                              { key: 'honorariosProfesionales', label: '💰 Hon. Profesionales', base: resumen.profesionales?.honorario || 0 },
                              { key: 'honorariosMateriales', label: '💰 Hon. Materiales', base: resumen.materiales?.honorario || 0 },
                              { key: keyOtros, label: '💰 Hon. Otros / Gastos Grales.', base: baseOtrosGG },
                              { key: 'honorariosConfiguracion', label: '💰 Hon. Config. Presup.', base: resumen.configuracionPresupuesto?.honorario || 0 }
                            ];
                          })().filter(item => item.base > 0).map(({ key, label, base }) => (
                            <div className="col-md-3" key={key}>
                              <div className="border rounded p-2" style={{backgroundColor: '#fff8e1'}}>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <small className="fw-bold" style={{color:'#e65100'}}>{label}</small>
                                  <div className="form-check form-check-sm">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={descuentosActual[key]?.activo !== false}
                                      onChange={(e) => setDescuentos(prev => ({
                                        ...prev,
                                        [key]: { ...(prev[key] || {}), activo: e.target.checked }
                                      }))}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                      Aplicar
                                    </label>
                                  </div>
                                </div>
                                <div className="d-flex justify-content-between mt-1">
                                  <span className="small">Base:</span>
                                  <span className="small fw-bold">${base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="mt-2 mb-2">
                                  <div className="d-flex gap-1 align-items-center">
                                    <select
                                      className="form-select form-select-sm"
                                      style={{ fontSize: '10px', padding: '2px' }}
                                      value={descuentosActual[key]?.tipo || 'porcentaje'}
                                      onChange={(e) => setDescuentos(prev => ({
                                        ...prev,
                                        [key]: { ...(prev[key] || {}), tipo: e.target.value }
                                      }))}
                                    >
                                      <option value="porcentaje">%</option>
                                      <option value="fijo">$</option>
                                    </select>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      style={{ fontSize: '10px', padding: '2px' }}
                                      placeholder={descuentosActual[key]?.tipo === 'porcentaje' ? '10' : '1000'}
                                      value={descuentosActual[key]?.valor || ''}
                                      onChange={(e) => {
                                        const valor = e.target.value;
                                        setDescuentos(prev => ({
                                          ...prev,
                                          [key]: {
                                            ...(prev[key] || {}),
                                            valor,
                                            activo: valor !== '' && Number(valor) !== 0
                                          }
                                        }));
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="d-flex justify-content-between text-danger">
                                  <span className="small">- Descuento:</span>
                                  <span className="small fw-bold">${(() => {
                                    if (descuentosActual[key]?.activo === false) return '0,00';
                                    const valor = Number(descuentosActual[key]?.valor || 0);
                                    if (valor > 0 && descuentosActual[key]?.tipo === 'porcentaje') {
                                      return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                    } else if (valor > 0) {
                                      return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                    }
                                    return '0,00';
                                  })()}</span>
                                </div>
                                <hr className="my-1" />
                                <div className="d-flex justify-content-between">
                                  <span className="small fw-bold">Total:</span>
                                  <span className="small fw-bold text-primary">${(() => {
                                    if (descuentosActual[key]?.activo === false) {
                                      return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                    }
                                    const valor = Number(descuentosActual[key]?.valor || 0);
                                    let descuento = 0;
                                    if (valor > 0 && descuentosActual[key]?.tipo === 'porcentaje') {
                                      descuento = (base * valor) / 100;
                                    } else if (valor > 0) {
                                      descuento = valor;
                                    }
                                    return (base - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                  })()}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <hr className="my-2" />
                      </>
                    )}

                    {/* ===== FILA 2: DESCUENTOS SOBRE BASES Y MAYORES COSTOS ===== */}
                    <div className="d-flex align-items-center gap-2 mb-2 px-2 py-1 rounded" style={{backgroundColor:'#e8f5e9', border:'1px solid #a5d6a7'}}>
                      <span style={{color:'#2e7d32', fontWeight:'bold', fontSize:'13px'}}>🔢 Descuentos sobre Bases y Mayores Costos</span>
                    </div>
                    <div className="row g-3 mb-3">
                      {/* Jornales */}
                      {resumen.jornales && (resumen.jornales.baseOriginal > 0 || resumen.jornales.base > 0) && (
                      <div className="col-md-3">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">🏗️ Jornales</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={descuentosActual.jornales?.activo !== false}
                                onChange={(e) => setDescuentos(prev => ({
                                  ...prev,
                                  jornales: { ...prev.jornales, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${(resumen.jornales.baseOriginal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={descuentosActual.jornales?.tipo || 'porcentaje'}
                                onChange={(e) => setDescuentos(prev => ({
                                  ...prev,
                                  jornales: { ...prev.jornales, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={descuentosActual.jornales?.tipo === 'porcentaje' ? '10' : '1000'}
                                value={descuentosActual.jornales?.valor || ''}
                                onChange={(e) => {
                                  setDescuentos(prev => ({
                                    ...prev,
                                    jornales: { ...prev.jornales, valor: e.target.value }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-danger">
                            <span className="small">- Descuento:</span>
                            <span className="small fw-bold">${(() => {
                              if (descuentosActual.jornales?.activo === false) return '0,00';
                              const base = resumen.jornales.baseOriginal || 0;
                              const valor = Number(descuentosActual.jornales?.valor || 0);

                              if (valor === 0) return '0,00';
                              if (descuentosActual.jornales?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = resumen.jornales.baseOriginal || 0;
                              if (descuentosActual.jornales?.activo === false) {
                                return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              const valor = Number(descuentosActual.jornales?.valor || 0);
                              let descuento = 0;
                              if (valor > 0) {
                                if (descuentosActual.jornales?.tipo === 'porcentaje') {
                                  descuento = (base * valor) / 100;
                                } else {
                                  descuento = valor;
                                }
                              }
                              return (base - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Materiales */}
                      {resumen.materiales && (resumen.materiales.baseOriginal > 0 || resumen.materiales.base > 0) && (
                      <div className="col-md-3">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">🧱 Materiales</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={descuentosActual.materiales?.activo !== false}
                                onChange={(e) => setDescuentos(prev => ({
                                  ...prev,
                                  materiales: { ...prev.materiales, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (sin honorarios):</span>
                            <span className="small fw-bold">${(resumen.materiales.baseOriginal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={descuentosActual.materiales.tipo}
                                onChange={(e) => setDescuentos(prev => ({
                                  ...prev,
                                  materiales: { ...prev.materiales, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={descuentosActual.materiales.tipo === 'porcentaje' ? '10' : '1000'}
                                value={descuentosActual.materiales.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setDescuentos(prev => ({
                                    ...prev,
                                    materiales: {
                                      ...prev.materiales,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-danger">
                            <span className="small">- Descuento:</span>
                            <span className="small fw-bold">${(() => {
                              if (descuentosActual.materiales?.activo === false) return '0,00';
                              const base = resumen.materiales.baseOriginal || 0;
                              const valor = Number(descuentosActual.materiales?.valor || 0);
                              if (valor > 0 && descuentosActual.materiales?.tipo === 'porcentaje') {
                                return ((base * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              const base = resumen.materiales.baseOriginal || 0;
                              if (descuentosActual.materiales?.activo === false) return base.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              const valor = Number(descuentosActual.materiales?.valor || 0);
                              let descuento = 0;
                              if (valor > 0 && descuentosActual.materiales?.tipo === 'porcentaje') {
                                descuento = (base * valor) / 100;
                              } else if (valor > 0) {
                                descuento = valor;
                              }
                              return (base - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Honorarios ya mostrados en la fila superior */}

                      {/* Mayores Costos (Total de todos los mayores costos aplicados) */}
                      {(() => {
                        // Calcular total de mayores costos
                        let totalMayoresCostos = 0;

                        // Jornales
                        if (mayoresCostosActual.jornales?.activo !== false) {
                          const baseJornales = resumen.jornales?.baseOriginal || 0;
                          const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                          if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                            totalMayoresCostos += (baseJornales * valorJornales) / 100;
                          } else if (valorJornales > 0) {
                            totalMayoresCostos += valorJornales;
                          }
                        }

                        // Profesionales
                        if (mayoresCostosActual.profesionales?.activo !== false) {
                          const baseProf = resumen.profesionales?.baseOriginal || 0;
                          const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                          if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                            totalMayoresCostos += (baseProf * valorProf) / 100;
                          } else if (valorProf > 0) {
                            totalMayoresCostos += valorProf;
                          }
                        }

                        // Materiales
                        if (mayoresCostosActual.materiales?.activo !== false) {
                          const baseMat = resumen.materiales?.baseOriginal || 0;
                          const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                          if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                            totalMayoresCostos += (baseMat * valorMat) / 100;
                          } else if (valorMat > 0) {
                            totalMayoresCostos += valorMat;
                          }
                        }

                        // Otros Costos
                        if (mayoresCostosActual.otrosCostos?.activo !== false) {
                          const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                          const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                          if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                            totalMayoresCostos += (baseOtros * valorOtros) / 100;
                          } else if (valorOtros > 0) {
                            totalMayoresCostos += valorOtros;
                          }
                        }

                        // Configuración
                        if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                          const baseConfig = resumen.configuracionPresupuesto?.baseOriginal || 0;
                          const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                          if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                            totalMayoresCostos += (baseConfig * valorConfig) / 100;
                          } else if (valorConfig > 0) {
                            totalMayoresCostos += valorConfig;
                          }
                        }

                        // Honorarios de mayores costos
                        if (mayoresCostosActual.honorarios?.activo !== false) {
                          const baseHon = resumen.honorarios?.base || 0;
                          const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                          if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                            totalMayoresCostos += (baseHon * valorHon) / 100;
                          } else if (valorHon > 0) {
                            totalMayoresCostos += valorHon;
                          }
                        }

                        return totalMayoresCostos > 0 && (
                      <div className="col-md-3">
                        <div className="border rounded p-2 bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">💰 Mayores Costos (total)</small>
                            <div className="form-check form-check-sm">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={descuentosActual.mayoresCostos?.activo !== false}
                                onChange={(e) => setDescuentos(prev => ({
                                  ...prev,
                                  mayoresCostos: { ...prev.mayoresCostos, activo: e.target.checked }
                                }))}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label small" style={{ fontSize: '10px' }}>
                                Aplicar
                              </label>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-1">
                            <span className="small">Base (Total mayores costos):</span>
                            <span className="small fw-bold">${totalMayoresCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="mt-2 mb-2">
                            <div className="d-flex gap-1 align-items-center">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                value={descuentosActual.mayoresCostos.tipo}
                                onChange={(e) => setDescuentos(prev => ({
                                  ...prev,
                                  mayoresCostos: { ...prev.mayoresCostos, tipo: e.target.value }
                                }))}
                              >
                                <option value="porcentaje">%</option>
                                <option value="fijo">$</option>
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ fontSize: '10px', padding: '2px' }}
                                placeholder={descuentosActual.mayoresCostos.tipo === 'porcentaje' ? '100' : totalMayoresCostos.toFixed(0)}
                                value={descuentosActual.mayoresCostos.valor}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setDescuentos(prev => ({
                                    ...prev,
                                    mayoresCostos: {
                                      ...prev.mayoresCostos,
                                      valor,
                                      activo: valor !== '' && Number(valor) !== 0
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-between text-danger">
                            <span className="small">- Descuento:</span>
                            <span className="small fw-bold">${(() => {
                              if (descuentosActual.mayoresCostos?.activo === false) return '0,00';
                              const valor = Number(descuentosActual.mayoresCostos?.valor || 0);
                              if (valor > 0 && descuentosActual.mayoresCostos?.tipo === 'porcentaje') {
                                return ((totalMayoresCostos * valor) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              } else if (valor > 0) {
                                return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              return '0,00';
                            })()}</span>
                          </div>
                          <hr className="my-1" />
                          <div className="d-flex justify-content-between">
                            <span className="small fw-bold">Total:</span>
                            <span className="small fw-bold text-primary">${(() => {
                              if (descuentosActual.mayoresCostos?.activo === false) {
                                return totalMayoresCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                              }
                              const valor = Number(descuentosActual.mayoresCostos?.valor || 0);
                              let descuento = 0;
                              if (valor > 0 && descuentosActual.mayoresCostos?.tipo === 'porcentaje') {
                                descuento = (totalMayoresCostos * valor) / 100;
                              } else if (valor > 0) {
                                descuento = valor;
                              }
                              // Si el descuento es del 100% o más, eliminar completamente los mayores costos
                              if (descuentosActual.mayoresCostos?.tipo === 'porcentaje' && valor >= 100) {
                                return '0,00';
                              }
                              return (totalMayoresCostos - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>
                        );
                      })()}
                    </div>

                    {/* Total General de Descuentos */}
                    <div className="border-top pt-3">
                      <div className="row">
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between">
                            <span>Subtotal (Sin descuentos):</span>
                            <span className="fw-bold">${(() => {
                              // Subtotal = TODAS las bases con honorarios y mayores costos
                              const baseJornales = resumen.jornales?.base || 0;
                              const baseProfesionales = resumen.profesionales?.base || 0;
                              const baseMateriales = resumen.materiales?.base || 0;
                              const baseOtrosCostos = (resumen.gastosGenerales?.base || 0) + (resumen.otrosCostos?.base || 0);
                              const baseConfiguracion = resumen.configuracionPresupuesto?.base || 0;
                              const baseHonorarios = resumen.honorarios?.base || 0;

                              // Calcular total de mayores costos
                              let totalMayoresCostos = 0;
                              if (mayoresCostosActual.jornales?.activo !== false) {
                                const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.jornales?.baseOriginal || 0) * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  totalMayoresCostos += valorJornales;
                                }
                              }
                              if (mayoresCostosActual.profesionales?.activo !== false) {
                                const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.profesionales?.baseOriginal || 0) * valorProf) / 100;
                                } else if (valorProf > 0) {
                                  totalMayoresCostos += valorProf;
                                }
                              }
                              if (mayoresCostosActual.materiales?.activo !== false) {
                                const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.materiales?.baseOriginal || 0) * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  totalMayoresCostos += valorMat;
                                }
                              }
                              if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                                if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseOtros * valorOtros) / 100;
                                } else if (valorOtros > 0) {
                                  totalMayoresCostos += valorOtros;
                                }
                              }
                              if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.configuracionPresupuesto?.baseOriginal || 0) * valorConfig) / 100;
                                } else if (valorConfig > 0) {
                                  totalMayoresCostos += valorConfig;
                                }
                              }
                              if (mayoresCostosActual.honorarios?.activo !== false) {
                                const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseHonorarios * valorHon) / 100;
                                } else if (valorHon > 0) {
                                  totalMayoresCostos += valorHon;
                                }
                              }

                              return (baseJornales + baseProfesionales + baseMateriales + baseOtrosCostos + baseConfiguracion + baseHonorarios + totalMayoresCostos).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between text-danger">
                            <span>Total Descuentos:</span>
                            <span className="fw-bold">${(() => {
                              // Calcular total de descuentos directamente respetando checkboxes
                              let total = 0;

                              // Jornales
                              if (descuentosActual.jornales?.activo !== false) {
                                const baseJornales = resumen.jornales?.baseOriginal || 0;
                                const valorJornales = Number(descuentosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && descuentosActual.jornales?.tipo === 'porcentaje') {
                                  total += (baseJornales * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  total += valorJornales;
                                }
                              }

                              // Materiales
                              if (descuentosActual.materiales?.activo !== false) {
                                const baseMat = resumen.materiales?.baseOriginal || 0;
                                const valorMat = Number(descuentosActual.materiales?.valor || 0);
                                if (valorMat > 0 && descuentosActual.materiales?.tipo === 'porcentaje') {
                                  total += (baseMat * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  total += valorMat;
                                }
                              }

                              // Honorarios (desglosado por sub-tipo)
                              total += calcularDescuentoHonorarios(resumen, descuentosActual);

                              // Mayores Costos
                              if (descuentosActual.mayoresCostos?.activo !== false) {
                                // Calcular total de mayores costos primero
                                let totalMayoresCostos = 0;
                                if (mayoresCostosActual.jornales?.activo !== false) {
                                  const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                  if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                    totalMayoresCostos += ((resumen.jornales?.baseOriginal || 0) * valorJornales) / 100;
                                  } else if (valorJornales > 0) {
                                    totalMayoresCostos += valorJornales;
                                  }
                                }
                                if (mayoresCostosActual.profesionales?.activo !== false) {
                                  const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                  if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                    totalMayoresCostos += ((resumen.profesionales?.baseOriginal || 0) * valorProf) / 100;
                                  } else if (valorProf > 0) {
                                    totalMayoresCostos += valorProf;
                                  }
                                }
                                if (mayoresCostosActual.materiales?.activo !== false) {
                                  const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                  if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                    totalMayoresCostos += ((resumen.materiales?.baseOriginal || 0) * valorMat) / 100;
                                  } else if (valorMat > 0) {
                                    totalMayoresCostos += valorMat;
                                  }
                                }
                                if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                  const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                  const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                                  if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                    totalMayoresCostos += (baseOtros * valorOtros) / 100;
                                  } else if (valorOtros > 0) {
                                    totalMayoresCostos += valorOtros;
                                  }
                                }
                                if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                  const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                  if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                    totalMayoresCostos += ((resumen.configuracionPresupuesto?.baseOriginal || 0) * valorConfig) / 100;
                                  } else if (valorConfig > 0) {
                                    totalMayoresCostos += valorConfig;
                                  }
                                }
                                if (mayoresCostosActual.honorarios?.activo !== false) {
                                  const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                  if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                    totalMayoresCostos += ((resumen.honorarios?.base || 0) * valorHon) / 100;
                                  } else if (valorHon > 0) {
                                    totalMayoresCostos += valorHon;
                                  }
                                }

                                // Aplicar descuento sobre el total de mayores costos
                                const valorDescMayoresCostos = Number(descuentosActual.mayoresCostos?.valor || 0);
                                if (valorDescMayoresCostos > 0 && descuentosActual.mayoresCostos?.tipo === 'porcentaje') {
                                  total += (totalMayoresCostos * valorDescMayoresCostos) / 100;
                                } else if (valorDescMayoresCostos > 0) {
                                  total += valorDescMayoresCostos;
                                }
                              }

                              return total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex justify-content-between">
                            <span className="fs-5 fw-bold">TOTAL FINAL:</span>
                            <span className="fs-5 fw-bold text-primary">${(() => {
                              // Calcular total final: subtotal - total descuentos
                              const baseJornales = resumen.jornales?.base || 0;
                              const baseProfesionales = resumen.profesionales?.base || 0;
                              const baseMateriales = resumen.materiales?.base || 0;
                              const baseOtrosCostos = (resumen.gastosGenerales?.base || 0) + (resumen.otrosCostos?.base || 0);
                              const baseConfiguracion = resumen.configuracionPresupuesto?.base || 0;
                              const baseHonorarios = resumen.honorarios?.base || 0;

                              // Bases originales sin honorarios (para calcular descuentos)
                              const baseJornalesOriginal = resumen.jornales?.baseOriginal || 0;
                              const baseMaterialesOriginal = resumen.materiales?.baseOriginal || 0;

                              // Calcular total de mayores costos
                              let totalMayoresCostos = 0;
                              if (mayoresCostosActual.jornales?.activo !== false) {
                                const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.jornales?.baseOriginal || 0) * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  totalMayoresCostos += valorJornales;
                                }
                              }
                              if (mayoresCostosActual.profesionales?.activo !== false) {
                                const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.profesionales?.baseOriginal || 0) * valorProf) / 100;
                                } else if (valorProf > 0) {
                                  totalMayoresCostos += valorProf;
                                }
                              }
                              if (mayoresCostosActual.materiales?.activo !== false) {
                                const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.materiales?.baseOriginal || 0) * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  totalMayoresCostos += valorMat;
                                }
                              }
                              if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                                if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseOtros * valorOtros) / 100;
                                } else if (valorOtros > 0) {
                                  totalMayoresCostos += valorOtros;
                                }
                              }
                              if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.configuracionPresupuesto?.baseOriginal || 0) * valorConfig) / 100;
                                } else if (valorConfig > 0) {
                                  totalMayoresCostos += valorConfig;
                                }
                              }
                              if (mayoresCostosActual.honorarios?.activo !== false) {
                                const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseHonorarios * valorHon) / 100;
                                } else if (valorHon > 0) {
                                  totalMayoresCostos += valorHon;
                                }
                              }

                              const subtotal = baseJornales + baseProfesionales + baseMateriales + baseOtrosCostos + baseConfiguracion + baseHonorarios + totalMayoresCostos;

                              // Calcular descuentos
                              let totalDescuentos = 0;

                              // Jornales (sobre base sin honorarios)
                              if (descuentosActual.jornales?.activo !== false) {
                                const valorJornales = Number(descuentosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && descuentosActual.jornales?.tipo === 'porcentaje') {
                                  totalDescuentos += (baseJornalesOriginal * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  totalDescuentos += valorJornales;
                                }
                              }

                              // Materiales (sobre base sin honorarios)
                              if (descuentosActual.materiales?.activo !== false) {
                                const valorMat = Number(descuentosActual.materiales?.valor || 0);
                                if (valorMat > 0 && descuentosActual.materiales?.tipo === 'porcentaje') {
                                  totalDescuentos += (baseMaterialesOriginal * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  totalDescuentos += valorMat;
                                }
                              }

                              // Honorarios (desglosado por sub-tipo)
                              totalDescuentos += calcularDescuentoHonorarios(resumen, descuentosActual);

                              // Mayores Costos
                              if (descuentosActual.mayoresCostos?.activo !== false) {
                                const valorDescMayoresCostos = Number(descuentosActual.mayoresCostos?.valor || 0);
                                if (valorDescMayoresCostos > 0 && descuentosActual.mayoresCostos?.tipo === 'porcentaje') {
                                  totalDescuentos += (totalMayoresCostos * valorDescMayoresCostos) / 100;
                                } else if (valorDescMayoresCostos > 0) {
                                  totalDescuentos += valorDescMayoresCostos;
                                }
                              }

                              return (subtotal - totalDescuentos).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            })()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Desglose por sección */}
                      <div className="alert alert-info mt-3 mb-0">
                        <strong>💸 Descuentos por sección:</strong>
                        <div className="row mt-2 small">
                          {(() => {
                            // Calcular descuento de jornales
                            let descuentoJornales = 0;
                            if (descuentosActual.jornales?.activo !== false) {
                              const base = resumen.jornales?.baseOriginal || 0;
                              const valor = Number(descuentosActual.jornales?.valor || 0);
                              if (valor > 0 && descuentosActual.jornales?.tipo === 'porcentaje') {
                                descuentoJornales = (base * valor) / 100;
                              } else if (valor > 0) {
                                descuentoJornales = valor;
                              }
                            }
                            return descuentoJornales > 0 && (
                              <div className="col-md-3">
                                🏗️ Jornales: <strong>${descuentoJornales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular descuento de materiales
                            let descuentoMat = 0;
                            if (descuentosActual.materiales?.activo !== false) {
                              const base = resumen.materiales?.baseOriginal || 0;
                              const valor = Number(descuentosActual.materiales?.valor || 0);
                              if (valor > 0 && descuentosActual.materiales?.tipo === 'porcentaje') {
                                descuentoMat = (base * valor) / 100;
                              } else if (valor > 0) {
                                descuentoMat = valor;
                              }
                            }
                            return descuentoMat > 0 && (
                              <div className="col-md-3">
                                🧱 Materiales: <strong>${descuentoMat.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular descuento de honorarios (desglosado)
                            const descuentoHon = calcularDescuentoHonorarios(resumen, descuentosActual);
                            return descuentoHon > 0 && (
                              <div className="col-md-3">
                                💰 Honorarios: <strong>${descuentoHon.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                          {(() => {
                            // Calcular descuento sobre mayores costos
                            let descuentoMayoresCostos = 0;
                            if (descuentosActual.mayoresCostos?.activo !== false) {
                              // Calcular total de mayores costos primero
                              let totalMayoresCostos = 0;
                              if (mayoresCostosActual.jornales?.activo !== false) {
                                const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.jornales?.baseOriginal || 0) * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  totalMayoresCostos += valorJornales;
                                }
                              }
                              if (mayoresCostosActual.profesionales?.activo !== false) {
                                const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.profesionales?.baseOriginal || 0) * valorProf) / 100;
                                } else if (valorProf > 0) {
                                  totalMayoresCostos += valorProf;
                                }
                              }
                              if (mayoresCostosActual.materiales?.activo !== false) {
                                const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.materiales?.baseOriginal || 0) * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  totalMayoresCostos += valorMat;
                                }
                              }
                              if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                                if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseOtros * valorOtros) / 100;
                                } else if (valorOtros > 0) {
                                  totalMayoresCostos += valorOtros;
                                }
                              }
                              if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.configuracionPresupuesto?.baseOriginal || 0) * valorConfig) / 100;
                                } else if (valorConfig > 0) {
                                  totalMayoresCostos += valorConfig;
                                }
                              }
                              if (mayoresCostosActual.honorarios?.activo !== false) {
                                const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.honorarios?.base || 0) * valorHon) / 100;
                                } else if (valorHon > 0) {
                                  totalMayoresCostos += valorHon;
                                }
                              }

                              // Aplicar descuento sobre el total de mayores costos
                              const valor = Number(descuentosActual.mayoresCostos?.valor || 0);
                              if (valor > 0 && descuentosActual.mayoresCostos?.tipo === 'porcentaje') {
                                descuentoMayoresCostos = (totalMayoresCostos * valor) / 100;
                              } else if (valor > 0) {
                                descuentoMayoresCostos = valor;
                              }
                            }
                            return descuentoMayoresCostos > 0 && (
                              <div className="col-md-3">
                                💰 Mayores Costos: <strong>${descuentoMayoresCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            );
                          })()}
                        </div>
                        <hr className="my-2" />
                        <div className="text-center">
                          <strong className="fs-6">🎯 TOTAL DESCUENTOS: ${(() => {
                            let total = 0;

                            // Jornales (sobre base sin honorarios)
                            if (descuentosActual.jornales?.activo !== false) {
                              const baseJornales = resumen.jornales?.baseOriginal || 0;
                              const valorJornales = Number(descuentosActual.jornales?.valor || 0);
                              if (valorJornales > 0 && descuentosActual.jornales?.tipo === 'porcentaje') {
                                total += (baseJornales * valorJornales) / 100;
                              } else if (valorJornales > 0) {
                                total += valorJornales;
                              }
                            }

                            // Materiales (sobre base sin honorarios)
                            if (descuentosActual.materiales?.activo !== false) {
                              const baseMat = resumen.materiales?.baseOriginal || 0;
                              const valorMat = Number(descuentosActual.materiales?.valor || 0);
                              if (valorMat > 0 && descuentosActual.materiales?.tipo === 'porcentaje') {
                                total += (baseMat * valorMat) / 100;
                              } else if (valorMat > 0) {
                                total += valorMat;
                              }
                            }

                            // Honorarios (desglosado por sub-tipo)
                            total += calcularDescuentoHonorarios(resumen, descuentosActual);

                            // Mayores Costos
                            if (descuentosActual.mayoresCostos?.activo !== false) {
                              // Calcular total de mayores costos primero
                              let totalMayoresCostos = 0;
                              if (mayoresCostosActual.jornales?.activo !== false) {
                                const valorJornales = Number(mayoresCostosActual.jornales?.valor || 0);
                                if (valorJornales > 0 && mayoresCostosActual.jornales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.jornales?.baseOriginal || 0) * valorJornales) / 100;
                                } else if (valorJornales > 0) {
                                  totalMayoresCostos += valorJornales;
                                }
                              }
                              if (mayoresCostosActual.profesionales?.activo !== false) {
                                const valorProf = Number(mayoresCostosActual.profesionales?.valor || 0);
                                if (valorProf > 0 && mayoresCostosActual.profesionales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.profesionales?.baseOriginal || 0) * valorProf) / 100;
                                } else if (valorProf > 0) {
                                  totalMayoresCostos += valorProf;
                                }
                              }
                              if (mayoresCostosActual.materiales?.activo !== false) {
                                const valorMat = Number(mayoresCostosActual.materiales?.valor || 0);
                                if (valorMat > 0 && mayoresCostosActual.materiales?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.materiales?.baseOriginal || 0) * valorMat) / 100;
                                } else if (valorMat > 0) {
                                  totalMayoresCostos += valorMat;
                                }
                              }
                              if (mayoresCostosActual.otrosCostos?.activo !== false) {
                                const valorOtros = Number(mayoresCostosActual.otrosCostos?.valor || 0);
                                const baseOtros = (resumen.gastosGenerales?.baseOriginal || 0) + (resumen.otrosCostos?.baseOriginal || 0);
                                if (valorOtros > 0 && mayoresCostosActual.otrosCostos?.tipo === 'porcentaje') {
                                  totalMayoresCostos += (baseOtros * valorOtros) / 100;
                                } else if (valorOtros > 0) {
                                  totalMayoresCostos += valorOtros;
                                }
                              }
                              if (mayoresCostosActual.configuracionPresupuesto?.activo !== false) {
                                const valorConfig = Number(mayoresCostosActual.configuracionPresupuesto?.valor || 0);
                                if (valorConfig > 0 && mayoresCostosActual.configuracionPresupuesto?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.configuracionPresupuesto?.baseOriginal || 0) * valorConfig) / 100;
                                } else if (valorConfig > 0) {
                                  totalMayoresCostos += valorConfig;
                                }
                              }
                              if (mayoresCostosActual.honorarios?.activo !== false) {
                                const valorHon = Number(mayoresCostosActual.honorarios?.valor || 0);
                                if (valorHon > 0 && mayoresCostosActual.honorarios?.tipo === 'porcentaje') {
                                  totalMayoresCostos += ((resumen.honorarios?.base || 0) * valorHon) / 100;
                                } else if (valorHon > 0) {
                                  totalMayoresCostos += valorHon;
                                }
                              }

                              // Aplicar descuento sobre el total de mayores costos
                              const valorDescMayoresCostos = Number(descuentosActual.mayoresCostos?.valor || 0);
                              if (valorDescMayoresCostos > 0 && descuentosActual.mayoresCostos?.tipo === 'porcentaje') {
                                total += (totalMayoresCostos * valorDescMayoresCostos) / 100;
                              } else if (valorDescMayoresCostos > 0) {
                                total += valorDescMayoresCostos;
                              }
                            }

                            return total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                          })()}</strong>
                        </div>
                      </div>

                      {/* Botón para aceptar la configuración */}
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          className={`btn ${configuracionDescuentosAceptada ? 'btn-secondary' : 'btn-success'} btn-lg`}
                          onClick={() => {
                            if (!configuracionDescuentosAceptada) {
                              setConfiguracionDescuentosAceptada(true);
                              alert('Configuración de descuentos guardada temporalmente. Presione "Guardar" al final para confirmar todos los cambios.');
                            }
                          }}
                          disabled={configuracionDescuentosAceptada}
                        >
                          {configuracionDescuentosAceptada ? '✓ Configuración Aceptada' : '✅ Aceptar Configuración de Descuentos'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
  } catch (error) {
    console.error('Error en ConfiguracionPresupuestoSection:', error);
    return (
      <div className="alert alert-danger" role="alert">
        <h5 className="alert-heading">Error en Configuración de Presupuesto</h5>
        <p>Ha ocurrido un error al cargar esta sección. Error: {error.message}</p>
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => window.location.reload()}
        >
          Recargar Página
        </button>
      </div>
    );
  }
};

export default ConfiguracionPresupuestoSection;
