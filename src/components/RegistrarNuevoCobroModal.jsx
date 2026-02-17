import React, { useState, useEffect, memo, useCallback } from 'react';
import { registrarCobro, formatearMoneda, formatearFecha } from '../services/cobrosObraService';
import { registrarCobroEmpresa, asignarCobroAObras } from '../services/cobrosEmpresaService';
import {
  registrarCobro as registrarCobroUnificado,
  resolverEntidadFinancieraId
} from '../services/entidadesFinancierasService';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import DireccionObraSelector from './DireccionObraSelector';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Modal para REGISTRAR NUEVO COBRO
 * - Registra un cobro a nivel empresa
 * - Opcionalmente permite asignarlo inmediatamente a obras (total o parcial)
 * - Checkbox simple: "¿Asignar a obras ahora?"
 */
const RegistrarNuevoCobroModal = memo(({ show, onHide, onSuccess, obraId, obraDireccion }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estado del formulario principal
  const [formData, setFormData] = useState({
    montoTotal: '',
    descripcion: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    metodoPago: 'TRANSFERENCIA',
    numeroComprobante: '',
    observaciones: ''
  });

  // Control de asignación inmediata
  const [asignarAhora, setAsignarAhora] = useState(false);
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [distribucion, setDistribucion] = useState([]);
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState([]);
  const [tipoDistribucion, setTipoDistribucion] = useState('MONTO');

  // Estados para distribución por ítems POR CADA OBRA
  const [distribucionPorObra, setDistribucionPorObra] = useState({});
  const [tipoDistribucionPorObra, setTipoDistribucionPorObra] = useState({});
  const [obrasExpandidas, setObrasExpandidas] = useState([]);

  // Estados UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Determinar si es modo INDIVIDUAL (obra pre-seleccionada)
  const modoIndividual = !!obraDireccion;

  // Cargar obras disponibles al abrir
  useEffect(() => {
    if (show && empresaSeleccionada && !modoIndividual) {
      cargarObrasDisponibles();
    }

    // Reset form al abrir
    if (show) {
      resetForm();
    }
  }, [show, empresaSeleccionada, modoIndividual]);

  const resetForm = () => {
    setFormData({
      montoTotal: '',
      descripcion: '',
      fechaEmision: new Date().toISOString().split('T')[0],
      metodoPago: 'TRANSFERENCIA',
      numeroComprobante: '',
      observaciones: ''
    });
    setAsignarAhora(false);
    setDistribucion([]);
    setObrasSeleccionadas([]);
    setDistribucionPorObra({});
    setTipoDistribucionPorObra({});
    setObrasExpandidas([]);
    setError(null);
    setSuccessMessage(null);
  };

  const cargarObrasDisponibles = async () => {
    try {
      // 1. Cargar TODOS los presupuestos (obras normales Y trabajos extra)
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);

      let presupuestosData = Array.isArray(response) ? response :
                             response?.datos ? response.datos :
                             response?.content ? response.content :
                             response?.data ? response.data : [];

      // Filtrar solo APROBADO y EN_EJECUCION
      const estadosPermitidos = ['APROBADO', 'EN_EJECUCION'];
      presupuestosData = presupuestosData.filter(p => estadosPermitidos.includes(p.estado));

      // 🎯 SEPARAR trabajos extra de obras normales
      const presupuestosNormales = presupuestosData.filter(p => {
        const esTE = p.esPresupuestoTrabajoExtra === true ||
                     p.esPresupuestoTrabajoExtra === 'V' ||
                     p.es_obra_trabajo_extra === true;
        return !esTE;
      });

      const presupuestosTrabajosExtra = presupuestosData.filter(p => {
        const esTE = p.esPresupuestoTrabajoExtra === true ||
                     p.esPresupuestoTrabajoExtra === 'V' ||
                     p.es_obra_trabajo_extra === true;
        return esTE;
      });

      console.log('📋 Presupuestos Normales:', presupuestosNormales.length);
      console.log('🔧 Presupuestos Trabajos Extra:', presupuestosTrabajosExtra.length);

      // 2. Agrupar OBRAS NORMALES por dirección y quedarse solo con la última versión
      const obrasPorDireccion = {};
      presupuestosNormales.forEach(p => {
        const claveObra = `${p.direccionObraCalle}-${p.direccionObraAltura}-${p.direccionObraBarrio || ''}`;

        if (!obrasPorDireccion[claveObra]) {
          obrasPorDireccion[claveObra] = p;
        } else {
          const versionActual = p.numeroVersion || p.version || 0;
          const versionExistente = obrasPorDireccion[claveObra].numeroVersion || obrasPorDireccion[claveObra].version || 0;

          if (versionActual > versionExistente) {
            obrasPorDireccion[claveObra] = p;
          }
        }
      });

      const presupuestosUnicos = Object.values(obrasPorDireccion);

      // Convertir a formato de obras normales
      const obrasNormales = presupuestosUnicos.map(p => ({
        tipo: 'OBRA',
        obraId: p.obraId || p.id,
        presupuestoNoClienteId: p.id,
        barrio: p.direccionObraBarrio || null,
        calle: p.direccionObraCalle || '',
        altura: p.direccionObraAltura || '',
        ciudad: p.direccionObraCiudad || '',
        numero: p.direccionObraAltura || '',
        nombreObra: p.nombreObra || p.nombre || null,
        direccion: `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}, ${p.direccionObraCiudad || ''}`.trim(),
        nombre: p.nombreObra || p.nombre || `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}, ${p.direccionObraCiudad || ''}`.trim()
      }));

      // 3. Procesar TRABAJOS EXTRA (última versión por obraId)
      const trabajosExtraPorObraId = {};
      presupuestosTrabajosExtra.forEach(p => {
        const obraId = p.obraId || p.direccionObraId || p.id;
        const version = p.numeroVersion || p.version || 0;

        if (!trabajosExtraPorObraId[obraId] || version > (trabajosExtraPorObraId[obraId].numeroVersion || 0)) {
          trabajosExtraPorObraId[obraId] = p;
        }
      });

      const trabajosExtra = Object.values(trabajosExtraPorObraId).map(p => ({
        tipo: 'TRABAJO_EXTRA',
        trabajoExtraId: p.id, // El ID del presupuesto
        trabajoExtraObraId: p.obraId || p.direccionObraId, // ✅ El ID de la obra del trabajo extra (para vincular trabajos adicionales)
        presupuestoNoClienteId: p.id,
        obraId: p.obraId || p.direccionObraId,
        obraPadreId: p.obra_origen_id || p.obraOrigenId, // 🔍 ID de la obra principal (si existe)
        nombre: p.nombreObra || p.nombre || p.titulo || `Trabajo Extra #${p.id}`,
        nombreObra: p.nombreObra || p.nombre,
        direccion: `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}, ${p.direccionObraCiudad || ''}`.trim(),
        montoEstimado: p.totalPresupuesto || p.presupuestoTotal || p.total || 0,
        estado: p.estado
      }));

      console.log('✅ Trabajos Extra procesados:', trabajosExtra);

      // 2. Cargar trabajos adicionales
      let trabajosAdicionales = [];
      try {
        const responseTrab = await api.trabajosAdicionales.getAll(empresaSeleccionada.id);
        let trabajosData = Array.isArray(responseTrab) ? responseTrab :
                          responseTrab?.datos ? responseTrab.datos :
                          responseTrab?.data ? responseTrab.data : [];

        console.log('📋 Trabajos Adicionales RAW:', trabajosData);

        // Filtrar solo activos
        trabajosData = trabajosData.filter(t => t.estado !== 'CANCELADO' && t.estado !== 'COMPLETADO');

        trabajosAdicionales = trabajosData.map(t => ({
          tipo: 'TRABAJO_ADICIONAL',
          trabajoAdicionalId: t.id,
          obraId: t.obraId, // Preservar obraId para agrupación
          trabajoExtraId: t.trabajoExtraId, // ✅ Preservar vínculo con trabajo extra
          nombre: t.nombre || t.descripcion || `Trabajo Adicional #${t.id}`,
          descripcion: t.descripcion,
          montoEstimado: t.importe || t.montoEstimado || t.monto || 0,
          estado: t.estado
        }));

        console.log('✅ Trabajos Adicionales procesados:', trabajosAdicionales);
      } catch (err) {
        console.error('❌ Error cargando trabajos adicionales:', err);
      }

      // 3. Cargar obras independientes (obras manuales sin presupuesto) PRIMERO
      let obrasIndependientes = [];
      try {
        const responseObras = await api.obras.getObrasManuales(empresaSeleccionada.id);
        let obrasData = Array.isArray(responseObras) ? responseObras :
                       responseObras?.datos ? responseObras.datos :
                       responseObras?.data ? responseObras.data : [];

        console.log('🏗️ Obras Independientes RAW:', obrasData);

        // Filtrar solo activas y aprobadas
        obrasData = obrasData.filter(o =>
          o.estado === 'EN_PROGRESO' ||
          o.estado === 'ACTIVA' ||
          o.estado === 'APROBADO'
        );

        obrasIndependientes = obrasData.map(o => ({
          tipo: 'OBRA_INDEPENDIENTE',
          obraIndependienteId: o.id,
          nombre: o.nombre || o.nombreObra || o.direccion || `Obra Independiente #${o.id}`,
          direccion: o.direccion || o.direccionCompleta,
          presupuestoEstimado: o.presupuestoEstimado || o.totalPresupuesto || 0,
          estado: o.estado
        }));

        console.log('✅ Obras Independientes procesadas:', obrasIndependientes);
      } catch (err) {
        console.error('❌ Error cargando obras independientes:', err);
      }

      // 5. Agrupar entidades jerárquicamente (OBRA → TRABAJO EXTRA → TRABAJO ADICIONAL)
      const entidadesAgrupadas = [];

      console.log('🔍 Iniciando agrupación...');
      console.log('Obras normales:', obrasNormales.map(o => ({ id: o.obraId, nombre: o.nombreObra })));
      console.log('Trabajos extra:', trabajosExtra.map(te => ({ presupuestoId: te.trabajoExtraId, obraId: te.trabajoExtraObraId, obraPadreId: te.obraPadreId })));
      console.log('Trabajos adicionales:', trabajosAdicionales.map(ta => ({ id: ta.trabajoAdicionalId, obraId: ta.obraId, trabajoExtraId: ta.trabajoExtraId })));

      // Agregar obras normales con sus trabajos extra y adicionales
      obrasNormales.forEach(obra => {
        // NIVEL 0: Agregar la obra principal
        entidadesAgrupadas.push({
          ...obra,
          esGrupo: true,
          nivel: 0
        });

        // NIVEL 1: Buscar trabajos extra que pertenecen a esta obra
        // Los trabajos extra pueden vincularse por: te.obraPadreId === obra.obraId
        // O por tener trabajos adicionales que apuntan a ta.obraId === obra.obraId
        const extrasDeEstaObra = trabajosExtra.filter(te => {
          // Método 1: Vínculo directo por obraPadreId
          if (te.obraPadreId === obra.obraId) return true;

          // Método 2: Tiene trabajos adicionales que apuntan a esta obra
          const tieneAdicionalesDeEstaObra = trabajosAdicionales.some(ta =>
            ta.obraId === obra.obraId && ta.trabajoExtraId === te.trabajoExtraObraId
          );
          return tieneAdicionalesDeEstaObra;
        });

        console.log(`Obra ${obra.nombreObra} (${obra.obraId}) tiene ${extrasDeEstaObra.length} trabajos extra`);

        extrasDeEstaObra.forEach(te => {
          entidadesAgrupadas.push({
            ...te,
            esHijo: true,
            nivel: 1,
            obraPadreId: obra.obraId
          });

          // NIVEL 2: Buscar trabajos adicionales de este trabajo extra
          // Los trabajos adicionales tienen trabajoExtraId que apunta al obraId del trabajo extra
          const adicionalesDelTE = trabajosAdicionales.filter(ta =>
            ta.trabajoExtraId === te.trabajoExtraObraId
          );

          console.log(`  TE ${te.nombre} (obraId: ${te.trabajoExtraObraId}) tiene ${adicionalesDelTE.length} trabajos adicionales`);

          adicionalesDelTE.forEach(ta => {
            entidadesAgrupadas.push({
              ...ta,
              esHijo: true,
              esNieto: true,
              nivel: 2,
              obraPadreId: obra.obraId,
              trabajoExtraPadreObraId: te.trabajoExtraObraId
            });
          });
        });

        // NIVEL 1: Trabajos adicionales directos de la obra (sin trabajoExtraId)
        const adicionalesDirectos = trabajosAdicionales.filter(ta =>
          ta.obraId === obra.obraId && !ta.trabajoExtraId
        );

        console.log(`Obra ${obra.nombreObra} tiene ${adicionalesDirectos.length} trabajos adicionales directos`);

        adicionalesDirectos.forEach(ta => {
          entidadesAgrupadas.push({
            ...ta,
            esHijo: true,
            nivel: 1,
            obraPadreId: obra.obraId
          });
        });
      });

      // Recolectar IDs de trabajos extra que fueron agrupados
      const extrasAgrupados = new Set();
      entidadesAgrupadas.forEach(e => {
        if (e.tipo === 'TRABAJO_EXTRA' && e.esHijo) {
          extrasAgrupados.add(e.trabajoExtraObraId);
        }
      });

      console.log('Trabajos extra agrupados:', Array.from(extrasAgrupados));

      // Agregar trabajos adicionales sin obra asignada (huérfanos)
      const adicionalesSinObra = trabajosAdicionales.filter(ta => !ta.obraId && !ta.trabajoExtraId);
      adicionalesSinObra.forEach(ta => {
        entidadesAgrupadas.push({
          ...ta,
          nivel: 0
        });
      });

      // Agregar trabajos extra que NO fueron agrupados (huérfanos)
      const extrasSinObra = trabajosExtra.filter(te =>
        !extrasAgrupados.has(te.trabajoExtraObraId)
      );

      console.log(`Trabajos extra huérfanos: ${extrasSinObra.length}`);

      extrasSinObra.forEach(te => {
        entidadesAgrupadas.push({
          ...te,
          nivel: 0
        });
      });

      // Agregar obras independientes (siempre nivel 0, sin hijos)
      obrasIndependientes.forEach(oi => {
        entidadesAgrupadas.push({
          ...oi,
          nivel: 0
        });
      });

      console.log('🎯 ENTIDADES AGRUPADAS JERÁRQUICAMENTE:', entidadesAgrupadas);

      setObrasDisponibles(entidadesAgrupadas);

      // Inicializar distribución
      const distInicial = entidadesAgrupadas.map(entidad => ({
        obra: entidad,
        monto: 0,
        porcentaje: 0
      }));
      setDistribucion(distInicial);
    } catch (err) {
      console.error('Error cargando obras:', err);
      setError('Error al cargar las obras disponibles');
    }
  };

  const formatearDireccion = (entidad) => {
    if (!entidad) return 'Sin información';

    // Si es obra normal
    if (entidad.tipo === 'OBRA') {
      if (entidad.nombreObra) {
        return entidad.nombreObra;
      }
      const direccionCompleta = entidad.direccion || `${entidad.calle || ''} ${entidad.numero || ''}, ${entidad.ciudad || ''}`.trim();
      return direccionCompleta || `Obra #${entidad.presupuestoNoClienteId || entidad.obraId}`;
    }

    // Si es trabajo adicional
    if (entidad.tipo === 'TRABAJO_ADICIONAL') {
      return entidad.nombre || `Trabajo Adicional #${entidad.trabajoAdicionalId}`;
    }

    // Si es trabajo extra
    if (entidad.tipo === 'TRABAJO_EXTRA') {
      return entidad.nombre || `Trabajo Extra #${entidad.trabajoExtraId}`;
    }

    // Si es obra independiente
    if (entidad.tipo === 'OBRA_INDEPENDIENTE') {
      return entidad.nombre || entidad.direccion || `Obra Independiente #${entidad.obraIndependienteId}`;
    }

    return 'Entidad sin nombre';
  };

  const formatearDireccionCompleta = (entidad) => {
    if (!entidad) return null;

    // Si es obra normal, retornar la dirección
    if (entidad.tipo === 'OBRA' && entidad.nombreObra) {
      return entidad.direccion || `${entidad.calle || ''} ${entidad.numero || ''}, ${entidad.ciudad || ''}`.trim();
    }

    return null;
  };

  const obtenerIdUnico = (entidad) => {
    if (!entidad) return null;
    if (entidad.tipo === 'OBRA') return `obra-${entidad.presupuestoNoClienteId}`;
    if (entidad.tipo === 'TRABAJO_ADICIONAL') return `trabajo-${entidad.trabajoAdicionalId}`;
    if (entidad.tipo === 'TRABAJO_EXTRA') return `trabajo-extra-${entidad.trabajoExtraId}`;
    if (entidad.tipo === 'OBRA_INDEPENDIENTE') return `obra-indep-${entidad.obraIndependienteId}`;
    return null;
  };

  const puedeExpandirItems = (entidad) => {
    // Obras normales y trabajos extra pueden expandir ítems
    return entidad?.tipo === 'OBRA' || entidad?.tipo === 'TRABAJO_EXTRA';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMontoChange = (index, nuevoMonto) => {
    const montoTotalNum = parseFloat(formData.montoTotal) || 0;
    if (montoTotalNum === 0) return;

    const montoNum = parseFloat(nuevoMonto) || 0;
    const porcentaje = (montoNum / montoTotalNum) * 100;

    const nuevaDistribucion = [...distribucion];
    nuevaDistribucion[index] = {
      ...nuevaDistribucion[index],
      monto: montoNum,
      porcentaje: porcentaje
    };
    setDistribucion(nuevaDistribucion);
  };

  const handlePorcentajeChange = (index, nuevoPorcentaje) => {
    const montoTotalNum = parseFloat(formData.montoTotal) || 0;
    if (montoTotalNum === 0) return;

    const porcentajeNum = parseFloat(nuevoPorcentaje) || 0;
    const monto = (montoTotalNum * porcentajeNum) / 100;

    const nuevaDistribucion = [...distribucion];
    nuevaDistribucion[index] = {
      ...nuevaDistribucion[index],
      monto: monto,
      porcentaje: porcentajeNum
    };
    setDistribucion(nuevaDistribucion);
  };

  const toggleObraSeleccionada = (presupuestoId) => {
    setObrasSeleccionadas(prev =>
      prev.includes(presupuestoId)
        ? prev.filter(id => id !== presupuestoId)
        : [...prev, presupuestoId]
    );
  };

  const distribuirUniformemente = () => {
    const montoTotalNum = parseFloat(formData.montoTotal) || 0;
    if (montoTotalNum === 0 || obrasSeleccionadas.length === 0) return;

    const montoPorObra = montoTotalNum / obrasSeleccionadas.length;
    const porcentajePorObra = 100 / obrasSeleccionadas.length;

    const nuevaDistribucion = distribucion.map(d => {
      const idUnico = obtenerIdUnico(d.obra);
      if (obrasSeleccionadas.includes(idUnico)) {
        return {
          ...d,
          monto: montoPorObra,
          porcentaje: porcentajePorObra
        };
      }
      return { ...d, monto: 0, porcentaje: 0 };
    });

    setDistribucion(nuevaDistribucion);
  };

  const calcularTotales = () => {
    const obrasConMonto = distribucion.filter(d => {
      const idUnico = obtenerIdUnico(d.obra);
      return obrasSeleccionadas.includes(idUnico) && parseFloat(d.monto) > 0;
    });

    let totalMonto = 0;

    // Para cada obra, si tiene distribución por items, sumar los items; si no, sumar el monto de la obra
    obrasConMonto.forEach(d => {
      const obraId = obtenerIdUnico(d.obra);
      const distObra = distribucionPorObra[obraId];
      const estaExpandida = obrasExpandidas.includes(obraId);

      console.log('🔍 DEBUG calcularTotales:', {
        obraId,
        estaExpandida,
        tieneDistObra: !!distObra,
        distObra: distObra,
        montoObra: d.monto
      });

      if (estaExpandida && distObra) {
        // Si está expandida, sumar los items distribuidos
        const totalItems = parseFloat(distObra.profesionales?.monto || 0) +
                          parseFloat(distObra.materiales?.monto || 0) +
                          parseFloat(distObra.gastosGenerales?.monto || 0);
        console.log('✅ Obra expandida - sumando items:', totalItems);
        totalMonto += totalItems;
      } else {
        // Si no está expandida, usar el monto de la obra
        console.log('⚠️ Obra NO expandida - sumando monto completo:', d.monto);
        totalMonto += parseFloat(d.monto);
      }
    });

    const montoTotalCobro = parseFloat(formData.montoTotal) || 1;
    const totalPorcentaje = (totalMonto / montoTotalCobro) * 100;

    console.log('💰 TOTAL CALCULADO:', { totalMonto, totalPorcentaje });

    return { totalMonto, totalPorcentaje };
  };

  const toggleObraExpandida = (presupuestoId) => {
    setObrasExpandidas(prev => {
      const estaExpandida = prev.includes(presupuestoId);

      if (estaExpandida) {
        // Si se está colapsando, remover de la lista
        return prev.filter(id => id !== presupuestoId);
      } else {
        // Si se está expandiendo, inicializar distribución si no existe
        if (!distribucionPorObra[presupuestoId]) {
          setDistribucionPorObra(prevDist => ({
            ...prevDist,
            [presupuestoId]: {
              profesionales: { monto: 0, porcentaje: 0 },
              materiales: { monto: 0, porcentaje: 0 },
              gastosGenerales: { monto: 0, porcentaje: 0 }
            }
          }));
        }
        return [...prev, presupuestoId];
      }
    });
  };

  const handleCambiarTipoDistribucionObra = (obraId, tipo) => {
    setTipoDistribucionPorObra(prev => ({
      ...prev,
      [obraId]: tipo
    }));
  };

  const handleDistribucionItemsChange = (obraId, item, campo, valor) => {
    // Buscar el monto de la obra usando el ID único correcto
    const montoObra = distribucion.find(d => obtenerIdUnico(d.obra) === obraId)?.monto || 0;

    if (montoObra === 0) {
      console.warn('⚠️ No se puede distribuir: el monto de la obra es 0. Ingrese primero un monto para esta obra.');
      return;
    }

    const distActual = distribucionPorObra[obraId] || {
      profesionales: { monto: 0, porcentaje: 0 },
      materiales: { monto: 0, porcentaje: 0 },
      gastosGenerales: { monto: 0, porcentaje: 0 }
    };

    let nuevaDist = { ...distActual };

    if (campo === 'monto') {
      const montoNum = parseFloat(valor) || 0;
      const porcentaje = montoObra > 0 ? (montoNum / montoObra) * 100 : 0;
      nuevaDist[item] = { monto: montoNum, porcentaje: porcentaje };
    } else if (campo === 'porcentaje') {
      const porcentajeNum = parseFloat(valor) || 0;
      const monto = (montoObra * porcentajeNum) / 100;
      nuevaDist[item] = { monto: monto, porcentaje: porcentajeNum };
    }

    setDistribucionPorObra(prev => ({
      ...prev,
      [obraId]: nuevaDist
    }));
  };

  // -----------------------------------------------------------------------
  // Helper: registrar el cobro en el sistema unificado de entidades financieras
  // Es fire-and-forget: si el backend nuevo no esta desplegado, solo loguea warning
  // -----------------------------------------------------------------------
  const _registrarEnSistemaUnificado = async (empresaId, obraTipo, entidadId, monto, fechaCobro, extra = {}) => {
    const TIPOS_MAP = {
      'OBRA':              'OBRA_PRINCIPAL',
      'OBRA_INDEPENDIENTE': 'OBRA_INDEPENDIENTE',
      'TRABAJO_EXTRA':    'TRABAJO_EXTRA',
      'TRABAJO_ADICIONAL':'TRABAJO_ADICIONAL'
    };
    const tipoEntidad = TIPOS_MAP[obraTipo] || 'OBRA_PRINCIPAL';
    if (!entidadId) return;
    try {
      const efId = await resolverEntidadFinancieraId(empresaId, tipoEntidad, entidadId, extra);
      if (!efId) return;
      await registrarCobroUnificado({
        entidadFinancieraId: efId,
        empresaId,
        monto,
        fechaCobro
      });
    } catch (err) {
      console.warn('[SistemaUnificado] Cobro no registrado (backend pendiente de deploy):', err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const montoTotalNum = parseFloat(formData.montoTotal);

    if (!formData.montoTotal || montoTotalNum <= 0) {
      setError('Debe ingresar un monto total mayor a 0');
      return;
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    // Validar obraId en modo individual
    if (modoIndividual && !obraDireccion?.obraId) {
      setError('No se encontró el ID de la obra');
      return;
    }

    setLoading(true);

    try {
      // ========== MODO INDIVIDUAL: Obra pre-seleccionada ==========
      if (modoIndividual && obraDireccion) {
        const cobroData = {
          empresaId: empresaSeleccionada.id,
          presupuestoNoClienteId: obraDireccion.presupuestoNoClienteId,
          fechaCobro: formData.fechaEmision,
          monto: montoTotalNum,
          descripcion: formData.descripcion || `Cobro - ${formatearDireccion(obraDireccion)}`,
          metodoPago: formData.metodoPago,
          estado: 'COBRADO',
          numeroComprobante: formData.numeroComprobante || null,
          observaciones: formData.observaciones || null,
          asignaciones: [{
            obraId: obraDireccion.obraId,
            montoAsignado: montoTotalNum,
            observaciones: formData.observaciones || null
          }]
        };

        console.log('🚀 [INDIVIDUAL] Registrando cobro:', cobroData);
        const cobroCreado = await registrarCobro(cobroData, empresaSeleccionada.id);
        console.log('✅ Cobro registrado:', cobroCreado);

        // Registrar en sistema unificado (fire-and-forget)
        _registrarEnSistemaUnificado(
          empresaSeleccionada.id,
          obraDireccion.esObraIndependiente ? 'OBRA_INDEPENDIENTE' : 'OBRA',
          obraDireccion.obraId,
          montoTotalNum,
          formData.fechaEmision,
          {
            nombreDisplay: obraDireccion.direccion || null,
            presupuestoNoClienteId: obraDireccion.presupuestoNoClienteId ?? null
          }
        );

        eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
          presupuestoId: obraDireccion.presupuestoNoClienteId,
          monto: montoTotalNum
        });

        if (onSuccess) {
          onSuccess({
            mensaje: `Cobro registrado por ${formatearMoneda(montoTotalNum)}`,
            datos: { total: montoTotalNum, cantidad: 1 }
          });
        }

        setSuccessMessage(`✅ Cobro registrado por ${formatearMoneda(montoTotalNum)}`);
        setTimeout(() => {
          setSuccessMessage(null);
          onHide();
        }, 2000);

        return;
      }

      // ========== MODO CONSOLIDADO ==========
      const obrasConMonto = asignarAhora && obrasSeleccionadas.length > 0
        ? distribucion.filter(d => {
            const idUnico = obtenerIdUnico(d.obra);
            return obrasSeleccionadas.includes(idUnico) && parseFloat(d.monto) > 0;
          })
        : [];

      // Validar que no exceda el total
      if (obrasConMonto.length > 0) {
        const { totalMonto } = calcularTotales();
        if (totalMonto > montoTotalNum) {
          setError(`La suma asignada (${formatearMoneda(totalMonto)}) excede el monto total (${formatearMoneda(montoTotalNum)})`);
          setLoading(false);
          return;
        }
      }

      // PASO 1: Registrar cobro a empresa
      const cobroEmpresaData = {
        montoTotal: montoTotalNum,
        descripcion: formData.descripcion || (obrasConMonto.length > 0
          ? `Cobro con ${obrasConMonto.length} asignación(es)`
          : 'Cobro general - Disponible para asignar'),
        fechaCobro: formData.fechaEmision,
        metodoPago: formData.metodoPago,
        numeroComprobante: formData.numeroComprobante || null,
        observaciones: formData.observaciones || null
      };

      console.log('🚀 [PASO 1] Registrando cobro empresa:', cobroEmpresaData);
      const cobroCreado = await registrarCobroEmpresa(cobroEmpresaData, empresaSeleccionada.id);
      console.log('✅ Cobro empresa creado:', cobroCreado);

      // PASO 2: Asignar a obras si corresponde
      if (obrasConMonto.length > 0) {
        const asignaciones = obrasConMonto.map(d => {
          const idUnico = obtenerIdUnico(d.obra);
          const distObra = distribucionPorObra[idUnico];

          // Construir asignación básica
          const asignacion = {
            montoAsignado: parseFloat(d.monto),
            descripcion: `${d.porcentaje.toFixed(1)}% del cobro - ${formatearDireccion(d.obra)}`
          };

          // Asignar IDs según el tipo
          if (d.obra.tipo === 'OBRA') {
            asignacion.obraId = d.obra.obraId;
            asignacion.presupuestoId = d.obra.presupuestoNoClienteId;
          } else if (d.obra.tipo === 'TRABAJO_ADICIONAL') {
            asignacion.trabajoAdicionalId = d.obra.trabajoAdicionalId;
          } else if (d.obra.tipo === 'TRABAJO_EXTRA') {
            asignacion.trabajoExtraId = d.obra.trabajoExtraId;
          } else if (d.obra.tipo === 'OBRA_INDEPENDIENTE') {
            asignacion.obraIndependienteId = d.obra.obraIndependienteId;
          }

          // Añadir distribución por ítems si es obra normal o trabajo extra y existe distribución
          if ((d.obra.tipo === 'OBRA' || d.obra.tipo === 'TRABAJO_EXTRA') && distObra) {
            const distribucionItems = {};

            if (parseFloat(distObra.profesionales?.monto || 0) > 0) {
              distribucionItems.montoProfesionales = parseFloat(distObra.profesionales.monto);
              distribucionItems.porcentajeProfesionales = parseFloat(distObra.profesionales.porcentaje);
            }
            if (parseFloat(distObra.materiales?.monto || 0) > 0) {
              distribucionItems.montoMateriales = parseFloat(distObra.materiales.monto);
              distribucionItems.porcentajeMateriales = parseFloat(distObra.materiales.porcentaje);
            }
            if (parseFloat(distObra.gastosGenerales?.monto || 0) > 0) {
              distribucionItems.montoGastosGenerales = parseFloat(distObra.gastosGenerales.monto);
              distribucionItems.porcentajeGastosGenerales = parseFloat(distObra.gastosGenerales.porcentaje);
            }

            if (Object.keys(distribucionItems).length > 0) {
              asignacion.distribucionItems = distribucionItems;
            }
          }

          return asignacion;
        });

        console.log('🚀 [PASO 2] Asignando a obras:', asignaciones);
        const resultado = await asignarCobroAObras(cobroCreado.id, asignaciones, empresaSeleccionada.id);
        console.log('✅ Asignación exitosa:', resultado);

        // Registrar en sistema unificado (fire-and-forget) para cada entidad asignada
        obrasConMonto.forEach(d => {
          const entidadId =
            d.obra.tipo === 'OBRA'               ? d.obra.obraId :
            d.obra.tipo === 'OBRA_INDEPENDIENTE' ? (d.obra.obraIndependienteId || d.obra.obraId) :
            d.obra.tipo === 'TRABAJO_EXTRA'      ? d.obra.trabajoExtraId :
            d.obra.tipo === 'TRABAJO_ADICIONAL'  ? d.obra.trabajoAdicionalId : null;

          _registrarEnSistemaUnificado(
            empresaSeleccionada.id,
            d.obra.tipo,
            entidadId,
            parseFloat(d.monto),
            formData.fechaEmision,
            {
              nombreDisplay: d.obra.nombreObra || d.obra.descripcionObra || null,
              presupuestoNoClienteId: d.obra.presupuestoNoClienteId ?? null
            }
          );
        });

        // Notificar por cada entidad según su tipo
        obrasConMonto.forEach(d => {
          if (d.obra.tipo === 'OBRA') {
            eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
              presupuestoId: d.obra.presupuestoNoClienteId,
              monto: parseFloat(d.monto)
            });
          } else if (d.obra.tipo === 'TRABAJO_ADICIONAL') {
            eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
              trabajoAdicionalId: d.obra.trabajoAdicionalId,
              monto: parseFloat(d.monto)
            });
          } else if (d.obra.tipo === 'TRABAJO_EXTRA') {
            eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
              trabajoExtraId: d.obra.trabajoExtraId,
              monto: parseFloat(d.monto)
            });
          } else if (d.obra.tipo === 'OBRA_INDEPENDIENTE') {
            eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
              obraIndependienteId: d.obra.obraIndependienteId,
              monto: parseFloat(d.monto)
            });
          }
        });
      }

      const mensajeExito = obrasConMonto.length === 0
        ? `✅ Cobro de ${formatearMoneda(montoTotalNum)} registrado - Disponible para asignar`
        : `✅ Cobro registrado y asignado a ${obrasConMonto.length} entidad(es)`;

      setSuccessMessage(mensajeExito);

      if (onSuccess) {
        onSuccess({
          mensaje: mensajeExito,
          datos: { total: montoTotalNum, cantidad: obrasConMonto.length }
        });
      }

      setTimeout(() => {
        setSuccessMessage(null);
        onHide();
      }, 2000);

    } catch (err) {
      console.error('Error registrando cobro:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Error al registrar el cobro'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const { totalMonto, totalPorcentaje } = asignarAhora ? calcularTotales() : { totalMonto: 0, totalPorcentaje: 0 };

  return (
    <>
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                💰 Registrar Nuevo Cobro
                {modoIndividual && obraDireccion && (
                  <small className="d-block mt-1 opacity-75">
                    📍 {formatearDireccion(obraDireccion)}
                  </small>
                )}
              </h5>
              <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                {error && (
                  <div className="alert alert-danger alert-dismissible">
                    <i className="bi bi-exclamation-triangle"></i> {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                  </div>
                )}

                {successMessage && (
                  <div className="alert alert-success">
                    {successMessage}
                  </div>
                )}

                {/* Datos del Cobro */}
                <div className="card mb-3 border-primary">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">💵 Datos del Cobro</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label">
                          Monto Total <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-lg"
                          name="montoTotal"
                          value={formData.montoTotal}
                          onChange={handleInputChange}
                          placeholder="Ej: 500000"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Fecha de Cobro</label>
                        <input
                          type="date"
                          className="form-control"
                          name="fechaEmision"
                          value={formData.fechaEmision}
                          onChange={handleInputChange}
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Método de Pago</label>
                        <select
                          className="form-select"
                          name="metodoPago"
                          value={formData.metodoPago}
                          onChange={handleInputChange}
                        >
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="TRANSFERENCIA">Transferencia</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="TARJETA">Tarjeta</option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Descripción</label>
                        <textarea
                          className="form-control"
                          name="descripcion"
                          value={formData.descripcion}
                          onChange={handleInputChange}
                          rows="2"
                          placeholder="Ej: Pago cliente - Anticipo obras"
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">N° Comprobante</label>
                        <input
                          type="text"
                          className="form-control"
                          name="numeroComprobante"
                          value={formData.numeroComprobante}
                          onChange={handleInputChange}
                          placeholder="Opcional"
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Observaciones</label>
                        <textarea
                          className="form-control"
                          name="observaciones"
                          value={formData.observaciones}
                          onChange={handleInputChange}
                          rows="2"
                          placeholder="Notas adicionales..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Asignar Ahora (solo en modo consolidado) */}
                {!modoIndividual && (
                  <>
                    <div className="card mb-3 border-info">
                      <div className="card-body">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="asignarAhora"
                            checked={asignarAhora}
                            onChange={(e) => setAsignarAhora(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="asignarAhora">
                            <strong>¿Asignar a obras ahora?</strong>
                            <small className="d-block text-muted">
                              Si no marca esta opción, el cobro quedará disponible para asignar después
                            </small>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Distribución entre obras */}
                    {asignarAhora && (
                      <div className="card mb-3 border-success">
                        <div className="card-header bg-success text-white">
                          <h6 className="mb-0">📊 Distribución entre Obras</h6>
                        </div>
                        <div className="card-body">
                          {obrasDisponibles.length === 0 ? (
                            <p className="text-muted">No hay obras disponibles</p>
                          ) : (
                            <>
                              <div className="mb-3">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={distribuirUniformemente}
                                  disabled={obrasSeleccionadas.length === 0 || !formData.montoTotal}
                                >
                                  <i className="bi bi-distribute-vertical"></i> Distribuir Uniformemente
                                </button>
                                <small className="text-muted ms-2">
                                  {obrasSeleccionadas.length} obra(s) seleccionada(s)
                                </small>
                              </div>

                              <div className="table-responsive">
                                <table className="table table-sm">
                                  <thead>
                                    <tr>
                                      <th width="50">
                                        <input
                                          type="checkbox"
                                          className="form-check-input"
                                          checked={obrasSeleccionadas.length === obrasDisponibles.length}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setObrasSeleccionadas(obrasDisponibles.map(o => obtenerIdUnico(o)));
                                            } else {
                                              setObrasSeleccionadas([]);
                                            }
                                          }}
                                        />
                                      </th>
                                      <th>Obra / Trabajo / Proyecto</th>
                                      <th width="150" className="text-end">Monto ($)</th>
                                      <th width="100" className="text-end text-muted">%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {distribucion.map((d, index) => {
                                      const idUnico = obtenerIdUnico(d.obra);
                                      const isSelected = obrasSeleccionadas.includes(idUnico);
                                      const isExpanded = obrasExpandidas.includes(idUnico);
                                      const distObra = distribucionPorObra[idUnico];
                                      const permiteItems = puedeExpandirItems(d.obra);

                                      return (
                                        <React.Fragment key={idUnico}>
                                          <tr className={`${isSelected ? 'table-success' : ''} ${d.obra.esNieto ? 'bg-light bg-opacity-75' : d.obra.esHijo ? 'bg-light bg-opacity-50' : ''}`}
                                              style={{
                                                borderLeft: d.obra.esNieto ? '3px solid #adb5bd' : d.obra.esHijo ? '3px solid #dee2e6' : 'none'
                                              }}>
                                            <td>
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={isSelected}
                                                onChange={() => toggleObraSeleccionada(idUnico)}
                                              />
                                            </td>
                                            <td>
                                              <div className="d-flex align-items-center" style={{
                                                paddingLeft: d.obra.nivel === 2 ? '4rem' : d.obra.nivel === 1 ? '2rem' : '0'
                                              }}>
                                                {d.obra.esNieto && (
                                                  <span className="text-muted me-2" style={{fontSize: '0.75rem'}}>
                                                    <i className="bi bi-arrow-return-right"></i>
                                                    <i className="bi bi-arrow-return-right"></i>
                                                  </span>
                                                )}
                                                {d.obra.esHijo && !d.obra.esNieto && (
                                                  <span className="text-muted me-2" style={{fontSize: '0.8rem'}}>
                                                    <i className="bi bi-arrow-return-right"></i>
                                                  </span>
                                                )}
                                                {isSelected && permiteItems && (
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary me-2"
                                                    onClick={() => toggleObraExpandida(idUnico)}
                                                    title="Distribuir por ítems"
                                                    style={{
                                                      fontSize: '0.75rem',
                                                      padding: '2px 6px',
                                                      fontWeight: '600'
                                                    }}
                                                  >
                                                    <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} me-1`}></i>
                                                    Ítems
                                                  </button>
                                                )}
                                                <div>
                                                  <div>
                                                    <small className="fw-bold">{formatearDireccion(d.obra)}</small>
                                                    {formatearDireccionCompleta(d.obra) && (
                                                      <small className="d-block text-muted" style={{fontSize: '0.75rem'}}>
                                                        <i className="bi bi-geo-alt me-1"></i>
                                                        {formatearDireccionCompleta(d.obra)}
                                                      </small>
                                                    )}
                                                  </div>
                                                  <div className="mt-1">
                                                    {d.obra.tipo === 'TRABAJO_ADICIONAL' && (
                                                      <span className="badge bg-primary" style={{fontSize: '0.65rem'}}>🔧 Trabajo Adicional</span>
                                                    )}
                                                    {d.obra.tipo === 'TRABAJO_EXTRA' && (
                                                      <>
                                                        <span className="badge bg-info" style={{fontSize: '0.65rem'}}>⚡ Trabajo Extra</span>
                                                        {(() => {
                                                          const cantidadAdicionales = distribucion.filter(dist =>
                                                            dist.obra.esNieto && dist.obra.trabajoExtraPadreObraId === d.obra.trabajoExtraObraId
                                                          ).length;
                                                          return cantidadAdicionales > 0 ? (
                                                            <span className="badge bg-secondary ms-1" style={{fontSize: '0.65rem'}}>
                                                              <i className="bi bi-wrench"></i> {cantidadAdicionales}
                                                            </span>
                                                          ) : null;
                                                        })()}
                                                      </>
                                                    )}
                                                    {d.obra.tipo === 'OBRA_INDEPENDIENTE' && (
                                                      <span className="badge bg-warning text-dark" style={{fontSize: '0.65rem'}}>🏗️ Obra Independiente</span>
                                                    )}
                                                    {d.obra.tipo === 'OBRA' && (
                                                      <>
                                                        <span className="badge bg-success" style={{fontSize: '0.65rem'}}>📋 Obra Principal</span>
                                                        {d.obra.esGrupo && (() => {
                                                          const cantidadHijos = distribucion.filter(dist =>
                                                            dist.obra.esHijo && !dist.obra.esNieto && dist.obra.obraPadreId === d.obra.obraId
                                                          ).length;
                                                          return cantidadHijos > 0 ? (
                                                            <span className="badge bg-secondary ms-1" style={{fontSize: '0.65rem'}}>
                                                              <i className="bi bi-diagram-3"></i> {cantidadHijos} trabajo{cantidadHijos > 1 ? 's' : ''}
                                                            </span>
                                                          ) : null;
                                                        })()}
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                            <td>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm text-end"
                                                value={d.monto || ''}
                                                onChange={(e) => handleMontoChange(index, e.target.value)}
                                                disabled={!isSelected}
                                                min="0"
                                                step="0.01"
                                                style={{
                                                  MozAppearance: 'textfield',
                                                  WebkitAppearance: 'none',
                                                  appearance: 'textfield'
                                                }}
                                                onWheel={(e) => e.target.blur()}
                                              />
                                            </td>
                                            <td className="text-end text-muted">
                                              <small>{d.porcentaje.toFixed(2)}%</small>
                                            </td>
                                          </tr>

                                          {/* Distribución por ítems de esta obra */}
                                          {isExpanded && isSelected && permiteItems && (
                                            <tr className={isSelected ? 'table-success' : ''}>
                                              <td colSpan="5" className="p-0">
                                                <div className="bg-light border-top" style={{padding: '12px 20px'}}>
                                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <small className="text-muted fw-bold">
                                                      <i className="bi bi-box me-1"></i>
                                                      Distribuir {formatearMoneda(d.monto)} entre ítems
                                                    </small>
                                                    <div className="btn-group btn-group-sm" role="group">
                                                      <button
                                                        type="button"
                                                        className={`btn btn-sm ${(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                        onClick={() => handleCambiarTipoDistribucionObra(idUnico, 'MONTO')}
                                                      >
                                                        Por Monto
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className={`btn btn-sm ${(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'PORCENTAJE' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                        onClick={() => handleCambiarTipoDistribucionObra(idUnico, 'PORCENTAJE')}
                                                      >
                                                        Por %
                                                      </button>
                                                    </div>
                                                  </div>

                                                  <div className="row g-2">
                                                    {/* Profesionales / Jornales */}
                                                    <div className="col-md-3">
                                                      <div className="card border">
                                                        <div className="card-body p-2">
                                                          <div className="mb-1">
                                                            <small className="fw-bold">
                                                              <i className="bi bi-people-fill text-primary me-1"></i>
                                                              Profesionales/Jornales
                                                            </small>
                                                          </div>
                                                          <input
                                                            type="number"
                                                            className="form-control form-control-sm mb-1"
                                                            placeholder={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                            value={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO'
                                                              ? (distObra?.profesionales?.monto || '')
                                                              : (distObra?.profesionales?.porcentaje || '')}
                                                            onChange={(e) => handleDistribucionItemsChange(idUnico,
                                                              'profesionales',
                                                              (tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                              e.target.value
                                                            )}
                                                            min="0"
                                                            step={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                            max={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                            style={{
                                                              MozAppearance: 'textfield',
                                                              WebkitAppearance: 'none',
                                                              appearance: 'textfield'
                                                            }}
                                                            onWheel={(e) => e.target.blur()}
                                                          />
                                                          <small className="text-muted">
                                                            {(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO'
                                                              ? `${(distObra?.profesionales?.porcentaje || 0).toFixed(2)}%`
                                                              : formatearMoneda(parseFloat(distObra?.profesionales?.monto || 0))
                                                            }
                                                          </small>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Materiales */}
                                                    <div className="col-md-3">
                                                      <div className="card border">
                                                        <div className="card-body p-2">
                                                          <div className="mb-1">
                                                            <small className="fw-bold">
                                                              <i className="bi bi-tools text-warning me-1"></i>
                                                              Materiales
                                                            </small>
                                                          </div>
                                                          <input
                                                            type="number"
                                                            className="form-control form-control-sm mb-1"
                                                            placeholder={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                            value={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO'
                                                              ? (distObra?.materiales?.monto || '')
                                                              : (distObra?.materiales?.porcentaje || '')}
                                                            onChange={(e) => handleDistribucionItemsChange(idUnico,
                                                              'materiales',
                                                              (tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                              e.target.value
                                                            )}
                                                            min="0"
                                                            step={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                            max={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                            style={{
                                                              MozAppearance: 'textfield',
                                                              WebkitAppearance: 'none',
                                                              appearance: 'textfield'
                                                            }}
                                                            onWheel={(e) => e.target.blur()}
                                                          />
                                                          <small className="text-muted">
                                                            {(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO'
                                                              ? `${(distObra?.materiales?.porcentaje || 0).toFixed(2)}%`
                                                              : formatearMoneda(parseFloat(distObra?.materiales?.monto || 0))
                                                            }
                                                          </small>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Gastos Generales / Otros Costos */}
                                                    <div className="col-md-3">
                                                      <div className="card border">
                                                        <div className="card-body p-2">
                                                          <div className="mb-1">
                                                            <small className="fw-bold">
                                                              <i className="bi bi-receipt text-success me-1"></i>
                                                              Gastos Generales
                                                            </small>
                                                          </div>
                                                          <input
                                                            type="number"
                                                            className="form-control form-control-sm mb-1"
                                                            placeholder={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                            value={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO'
                                                              ? (distObra?.gastosGenerales?.monto || '')
                                                              : (distObra?.gastosGenerales?.porcentaje || '')}
                                                            onChange={(e) => handleDistribucionItemsChange(idUnico,
                                                              'gastosGenerales',
                                                              (tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                              e.target.value
                                                            )}
                                                            min="0"
                                                            step={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                            max={(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                            style={{
                                                              MozAppearance: 'textfield',
                                                              WebkitAppearance: 'none',
                                                              appearance: 'textfield'
                                                            }}
                                                            onWheel={(e) => e.target.blur()}
                                                          />
                                                          <small className="text-muted">
                                                            {(tipoDistribucionPorObra[idUnico] || 'MONTO') === 'MONTO'
                                                              ? `${(distObra?.gastosGenerales?.porcentaje || 0).toFixed(2)}%`
                                                              : formatearMoneda(parseFloat(distObra?.gastosGenerales?.monto || 0))
                                                            }
                                                          </small>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {/* Total distribuido */}
                                                  <div className="mt-2 pt-2 border-top">
                                                    <small className="text-muted">
                                                      <strong>Total distribuido:</strong>{' '}
                                                      {(() => {
                                                        const montoObra = parseFloat(d.monto) || 0;
                                                        const totalDist = parseFloat(distObra?.profesionales?.monto || 0) +
                                                                        parseFloat(distObra?.materiales?.monto || 0) +
                                                                        parseFloat(distObra?.gastosGenerales?.monto || 0);
                                                        const diferencia = montoObra - totalDist;
                                                        const colorClass = Math.abs(diferencia) < 0.01 ? 'text-success' : 'text-danger';
                                                        return (
                                                          <>
                                                            <span className={colorClass}>
                                                              {formatearMoneda(totalDist)}
                                                            </span>
                                                            {Math.abs(diferencia) >= 0.01 && (
                                                              <span className="text-danger ms-2">
                                                                (Falta: {formatearMoneda(diferencia)})
                                                              </span>
                                                            )}
                                                            {Math.abs(diferencia) < 0.01 && (
                                                              <span className="text-success ms-2">
                                                                <i className="bi bi-check-circle-fill"></i> Completo
                                                              </span>
                                                            )}
                                                          </>
                                                        );
                                                      })()}
                                                    </small>
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="table-dark">
                                      <td colSpan="2"><strong>TOTAL A ASIGNAR</strong></td>
                                      <td className="text-end"><strong>{formatearMoneda(totalMonto)}</strong></td>
                                      <td className="text-end"><strong>{totalPorcentaje.toFixed(2)}%</strong></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i> Registrar Cobro
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
});

export default RegistrarNuevoCobroModal;
