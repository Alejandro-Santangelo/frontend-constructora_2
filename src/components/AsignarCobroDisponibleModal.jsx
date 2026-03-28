import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { formatearMoneda, formatearFecha } from '../services/cobrosObraService';
import { listarCobrosEmpresa, asignarCobroAObras, obtenerDetalleCobroEmpresa, eliminarAsignacionCobroEmpresa, obtenerDistribucionPorObra } from '../services/cobrosEmpresaService';
import { actualizarAsignacion, obtenerAsignacionesDeObra } from '../services/asignacionesCobroObraService';
import {
  registrarCobro as registrarCobroUnificado,
  resolverEntidadFinancieraId
} from '../services/entidadesFinancierasService';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Modal para ASIGNAR SALDO DISPONIBLE
 * - Selecciona un cobro existente con saldo
 * - Distribuye ese saldo entre una o varias obras
 * - No crea cobros nuevos, solo asigna existentes
 */
const AsignarCobroDisponibleModal = memo(({ show, onHide, onSuccess, refreshTrigger }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Cobros disponibles
  const [cobrosDisponibles, setCobrosDisponibles] = useState([]);
  const [cobroSeleccionado, setCobroSeleccionado] = useState(null);
  const [cargandoCobros, setCargandoCobros] = useState(false);

  // Asignaciones actuales del cobro seleccionado
  const [asignacionesActuales, setAsignacionesActuales] = useState([]);
  const [cargandoAsignaciones, setCargandoAsignaciones] = useState(false);

  // Distribución
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [distribucion, setDistribucion] = useState([]);
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState([]);
  const [tipoDistribucion, setTipoDistribucion] = useState('MONTO');

  // Estados para distribución por ítems POR CADA OBRA
  const [distribucionPorObra, setDistribucionPorObra] = useState({});
  const [tipoDistribucionPorObra, setTipoDistribucionPorObra] = useState({});
  const [obrasExpandidas, setObrasExpandidas] = useState([]);

  // 🆕 Estados para editar asignaciones existentes
  const [asignacionesExistentes, setAsignacionesExistentes] = useState([]);
  const [editandoAsignacion, setEditandoAsignacion] = useState(null);
  const [formEdicionAsignacion, setFormEdicionAsignacion] = useState({
    montoProfesionales: 0,
    montoMateriales: 0,
    montoGastosGenerales: 0
  });
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Helper: Calcular totales de rubros desde presupuesto
  const calcularTotalesPresupuesto = (presupuesto) => {
    let totalJornales = 0;
    let totalMateriales = 0;
    let totalGastosGenerales = 0;

    // Calcular desde itemsCalculadora usando los subtotales directos
    if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
      presupuesto.itemsCalculadora.forEach(item => {
        // Sumar jornales/mano de obra (ya calculado por el backend)
        totalJornales += item.subtotalManoObra || 0;

        // Sumar materiales (ya calculado por el backend)
        totalMateriales += item.subtotalMateriales || 0;

        // Sumar gastos generales (ya calculado por el backend)
        totalGastosGenerales += item.subtotalGastosGenerales || 0;
      });
    }

    return {
      totalJornales,
      totalMateriales,
      totalGastosGenerales
    };
  };

  // Cargar cobros disponibles y asignaciones existentes al abrir O cuando cambia refreshTrigger
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarCobrosDisponibles();
      cargarObrasDisponibles();
      cargarAsignacionesExistentes();
    }

    if (show) {
      resetForm();
    }
  }, [show, empresaSeleccionada, refreshTrigger]);

  const resetForm = () => {
    setCobroSeleccionado(null);
    setDistribucion([]);
    setObrasSeleccionadas([]);
    setDistribucionPorObra({});
    setTipoDistribucionPorObra({});
    setObrasExpandidas([]);
    setError(null);
    setSuccessMessage(null);
  };

  const cargarCobrosDisponibles = useCallback(async () => {
    setCargandoCobros(true);
    try {
      const cobros = await listarCobrosEmpresa(empresaSeleccionada.id);

      // Filtrar solo cobros con saldo disponible
      const cobrosConSaldo = cobros.filter(c => {
        const disponible = parseFloat(c.montoDisponible || 0);
        return disponible > 0.01;
      });

      console.log('💰 Cobros con saldo disponible:', cobrosConSaldo.length);
      setCobrosDisponibles(cobrosConSaldo);
    } catch (err) {
      console.error('Error cargando cobros:', err);
      setError('Error al cargar cobros disponibles');
    } finally {
      setCargandoCobros(false);
    }
  }, [empresaSeleccionada]);

  const cargarAsignacionesExistentes = useCallback(async () => {
    try {
      const distribucion = await obtenerDistribucionPorObra(empresaSeleccionada.id);
      console.log('🔍 Distribución completa del backend:', distribucion);

      const distribucionUnica = Array.isArray(distribucion)
        ? distribucion.filter((obra, index, self) =>
            index === self.findIndex(o => o.obraId === obra.obraId)
          )
        : [];

      console.log('🔍 Ejemplo de objeto obra:', distribucionUnica[0]);

      // Filtrar solo las que tienen saldo sin distribuir
      const conSaldoSinDistribuir = distribucionUnica.filter(obra => {
        const totalAsignado = obra.totalCobradoAsignado || 0;
        const totalDistribuido = (obra.montoProfesionales || 0) +
                                (obra.montoMateriales || 0) +
                                (obra.montoGastosGenerales || 0);
        const saldoSinDistribuir = totalAsignado - totalDistribuido;
        return saldoSinDistribuir > 0.01;
      });

      console.log('🔍 Asignaciones con saldo sin distribuir:', conSaldoSinDistribuir.length);
      setAsignacionesExistentes(conSaldoSinDistribuir);
    } catch (error) {
      console.error('Error cargando asignaciones existentes:', error);
    }
  }, [empresaSeleccionada]);

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

      // Convertir a formato de obras normales CON totales de rubros
      const obrasNormalesPromises = presupuestosUnicos.map(async (p) => {
        // Si no tiene itemsCalculadora, cargar el detalle completo
        let presupuestoCompleto = p;
        if (!p.itemsCalculadora || !Array.isArray(p.itemsCalculadora) || p.itemsCalculadora.length === 0) {
          console.log(`📥 Cargando detalle completo para presupuesto #${p.id}`);
          presupuestoCompleto = await api.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id);
        }

        const totales = calcularTotalesPresupuesto(presupuestoCompleto);
        console.log(`📊 Totales calculados para presupuesto ${p.id}:`, totales);

        return {
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
          nombre: p.nombreObra || p.nombre || `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}, ${p.direccionObraCiudad || ''}`.trim(),
          ...totales,  // ✅ Agregar totalJornales, totalMateriales, totalGastosGenerales
          itemsCalculadora: presupuestoCompleto.itemsCalculadora || []  // ✅ Desglose por rubro
        };
      });

      const obrasNormales = await Promise.all(obrasNormalesPromises);

      // 3. Procesar TRABAJOS EXTRA (última versión por obraId)
      const trabajosExtraPorObraId = {};
      presupuestosTrabajosExtra.forEach(p => {
        const obraId = p.obraId || p.obra_id || p.direccionObraId || p.id;
        const version = p.numeroVersion || p.version || 0;

        if (!trabajosExtraPorObraId[obraId] || version > (trabajosExtraPorObraId[obraId].numeroVersion || 0)) {
          trabajosExtraPorObraId[obraId] = p;
        }
      });

      const trabajosExtraPromises = Object.values(trabajosExtraPorObraId).map(async (p) => {
        // Si no tiene itemsCalculadora, cargar el detalle completo
        let presupuestoCompleto = p;
        if (!p.itemsCalculadora || !Array.isArray(p.itemsCalculadora) || p.itemsCalculadora.length === 0) {
          console.log(`📥 Cargando detalle completo para trabajo extra presupuesto #${p.id}`);
          presupuestoCompleto = await api.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id);
        }

        const totales = calcularTotalesPresupuesto(presupuestoCompleto);
        console.log(`📊 Totales calculados para trabajo extra ${p.id}:`, totales);

        return {
          tipo: 'TRABAJO_EXTRA',
          trabajoExtraId: p.id,
          trabajoExtraObraId: p.obraId || p.obra_id || p.direccionObraId,
          presupuestoNoClienteId: p.id,
          obraId: p.obraId || p.obra_id || p.direccionObraId,
          obraPadreId: p.obra_origen_id || p.obraOrigenId,
          nombre: p.nombreObra || p.nombre || p.titulo || `Trabajo Extra #${p.id}`,
          nombreObra: p.nombreObra || p.nombre,
          direccion: `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}, ${p.direccionObraCiudad || ''}`.trim(),
          montoEstimado: p.totalPresupuesto || p.presupuestoTotal || p.total || 0,
          estado: p.estado,
          ...totales,  // ✅ Agregar totalJornales, totalMateriales, totalGastosGenerales
          itemsCalculadora: presupuestoCompleto.itemsCalculadora || []  // ✅ Desglose por rubro
        };
      });

      const trabajosExtra = await Promise.all(trabajosExtraPromises);

      // 4. Cargar trabajos adicionales
      let trabajosAdicionales = [];
      try {
        const responseTrab = await api.trabajosAdicionales.getAll(empresaSeleccionada.id);
        let trabajosData = Array.isArray(responseTrab) ? responseTrab :
                          responseTrab?.datos ? responseTrab.datos :
                          responseTrab?.data ? responseTrab.data : [];

        trabajosData = trabajosData.filter(t => t.estado !== 'CANCELADO' && t.estado !== 'COMPLETADO');

        trabajosAdicionales = trabajosData.map(t => ({
          tipo: 'TRABAJO_ADICIONAL',
          trabajoAdicionalId: t.id,
          obraId: t.obraId,
          trabajoExtraId: t.trabajoExtraId,
          nombre: t.nombre || t.descripcion || `Trabajo Adicional #${t.id}`,
          descripcion: t.descripcion,
          montoEstimado: t.importe || t.montoEstimado || t.monto || 0,
          estado: t.estado
        }));
      } catch (err) {
        console.error('❌ Error cargando trabajos adicionales:', err);
      }

      // 5. Cargar obras independientes
      let obrasIndependientes = [];
      try {
        const responseObras = await api.obras.getObrasManuales(empresaSeleccionada.id);
        let obrasData = Array.isArray(responseObras) ? responseObras :
                       responseObras?.datos ? responseObras.datos :
                       responseObras?.data ? responseObras.data : [];

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
      } catch (err) {
        console.error('❌ Error cargando obras independientes:', err);
      }

      // 6. Agrupar entidades jerárquicamente
      const entidadesAgrupadas = [];

      obrasNormales.forEach(obra => {
        // NIVEL 0: Obra principal
        entidadesAgrupadas.push({
          ...obra,
          esGrupo: true,
          nivel: 0
        });

        // NIVEL 1: Trabajos extra de esta obra
        const extrasDeEstaObra = trabajosExtra.filter(te => {
          if (te.obraPadreId === obra.obraId) return true;
          const tieneAdicionalesDeEstaObra = trabajosAdicionales.some(ta =>
            ta.obraId === obra.obraId && ta.trabajoExtraId === te.trabajoExtraObraId
          );
          return tieneAdicionalesDeEstaObra;
        });

        extrasDeEstaObra.forEach(te => {
          entidadesAgrupadas.push({
            ...te,
            esHijo: true,
            nivel: 1,
            obraPadreId: obra.obraId
          });

          // NIVEL 2: Trabajos adicionales del trabajo extra
          const adicionalesDelTE = trabajosAdicionales.filter(ta =>
            ta.trabajoExtraId === te.trabajoExtraObraId
          );

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

        // NIVEL 1: Trabajos adicionales directos (sin trabajoExtraId)
        const adicionalesDirectos = trabajosAdicionales.filter(ta =>
          ta.obraId === obra.obraId && !ta.trabajoExtraId
        );

        adicionalesDirectos.forEach(ta => {
          entidadesAgrupadas.push({
            ...ta,
            esHijo: true,
            nivel: 1,
            obraPadreId: obra.obraId
          });
        });
      });

      // Recolectar trabajos extra agrupados
      const extrasAgrupados = new Set();
      entidadesAgrupadas.forEach(e => {
        if (e.tipo === 'TRABAJO_EXTRA' && e.esHijo) {
          extrasAgrupados.add(e.trabajoExtraObraId);
        }
      });

      // Huérfanos
      const adicionalesSinObra = trabajosAdicionales.filter(ta => !ta.obraId && !ta.trabajoExtraId);
      adicionalesSinObra.forEach(ta => {
        entidadesAgrupadas.push({
          ...ta,
          nivel: 0
        });
      });

      const extrasSinObra = trabajosExtra.filter(te =>
        !extrasAgrupados.has(te.trabajoExtraObraId)
      );
      extrasSinObra.forEach(te => {
        entidadesAgrupadas.push({
          ...te,
          nivel: 0
        });
      });

      obrasIndependientes.forEach(oi => {
        entidadesAgrupadas.push({
          ...oi,
          nivel: 0
        });
      });

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
      const direccion = `${entidad.calle || ''} ${entidad.numero || ''}, ${entidad.ciudad || ''}`.trim();
      return direccion || `Obra #${entidad.presupuestoNoClienteId}`;
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
      return entidad.nombre || `Obra Independiente #${entidad.obraIndependienteId}`;
    }

    return 'Sin información';
  };

  const formatearDireccionCompleta = (entidad) => {
    if (!entidad) return null;
    if (entidad.tipo === 'OBRA' && entidad.nombreObra) {
      return entidad.direccion;
    }
    return null;
  };

  const obtenerIdUnico = (entidad) => {
    if (!entidad) return null;
    if (entidad.tipo === 'TRABAJO_ADICIONAL') return `trabajo-${entidad.trabajoAdicionalId}`;
    if (entidad.tipo === 'TRABAJO_EXTRA') return `trabajo-extra-${entidad.trabajoExtraId}`;
    if (entidad.tipo === 'OBRA_INDEPENDIENTE') return `obra-indep-${entidad.obraIndependienteId}`;
    return `obra-${entidad.presupuestoNoClienteId}`;
  };

  const puedeExpandirItems = (entidad) => {
    // Obras normales y trabajos extra pueden expandir ítems
    return entidad?.tipo === 'OBRA' || entidad?.tipo === 'TRABAJO_EXTRA';
  };

  const cargarAsignacionesActuales = useCallback(async (cobroId) => {
    if (!cobroId || !empresaSeleccionada) return;

    setCargandoAsignaciones(true);
    try {
      const detalle = await obtenerDetalleCobroEmpresa(cobroId, empresaSeleccionada.id);
      setAsignacionesActuales(detalle.asignaciones || []);
    } catch (err) {
      console.error('Error cargando asignaciones actuales:', err);
      setAsignacionesActuales([]);
    } finally {
      setCargandoAsignaciones(false);
    }
  }, [empresaSeleccionada]);

  const handleEliminarAsignacion = async (asignacionId) => {
    if (!cobroSeleccionado || !empresaSeleccionada) return;

    if (!window.confirm('¿Está seguro de eliminar esta asignación? El saldo volverá a estar disponible.')) {
      return;
    }

    try {
      await eliminarAsignacionCobroEmpresa(
        cobroSeleccionado.id,
        asignacionId,
        empresaSeleccionada.id
      );

      // Recargar asignaciones actuales
      await cargarAsignacionesActuales(cobroSeleccionado.id);

      // Recargar cobros disponibles para actualizar saldo
      await cargarCobrosDisponibles();

      setSuccessMessage('Asignación eliminada correctamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error eliminando asignación:', err);
      setError('Error al eliminar la asignación: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleSeleccionarCobro = (cobro) => {
    setCobroSeleccionado(cobro);
    setError(null);

    // Cargar asignaciones actuales del cobro seleccionado
    cargarAsignacionesActuales(cobro.id);

    // Reiniciar distribución
    const distInicial = obrasDisponibles.map(obra => ({
      obra: obra,
      monto: 0,
      porcentaje: 0
    }));
    setDistribucion(distInicial);
    setObrasSeleccionadas([]);
    setDistribucionPorObra({});
    setTipoDistribucionPorObra({});
    setObrasExpandidas([]);
  };

  const handleMontoChange = (index, nuevoMonto) => {
    if (!cobroSeleccionado) return;

    const montoDisponible = parseFloat(cobroSeleccionado.montoDisponible || 0);
    if (montoDisponible === 0) return;

    const montoNum = parseFloat(nuevoMonto) || 0;
    const porcentaje = (montoNum / montoDisponible) * 100;

    const nuevaDistribucion = [...distribucion];
    nuevaDistribucion[index] = {
      ...nuevaDistribucion[index],
      monto: montoNum,
      porcentaje: porcentaje
    };
    setDistribucion(nuevaDistribucion);
  };

  const handlePorcentajeChange = (index, nuevoPorcentaje) => {
    if (!cobroSeleccionado) return;

    const montoDisponible = parseFloat(cobroSeleccionado.montoDisponible || 0);
    if (montoDisponible === 0) return;

    const porcentajeNum = parseFloat(nuevoPorcentaje) || 0;
    const monto = (montoDisponible * porcentajeNum) / 100;

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

  const distribuirUniformemente = useCallback(() => {
    if (!cobroSeleccionado) return;

    const montoDisponible = parseFloat(cobroSeleccionado.montoDisponible || 0);
    if (montoDisponible === 0 || obrasSeleccionadas.length === 0) return;

    const montoPorObra = montoDisponible / obrasSeleccionadas.length;
    const porcentajePorObra = 100 / obrasSeleccionadas.length;

    // Verificar si ya está distribuido uniformemente
    const obrasSeleccionadasConMonto = distribucion.filter(d => {
      const idUnico = obtenerIdUnico(d.obra);
      return obrasSeleccionadas.includes(idUnico) && parseFloat(d.monto || 0) > 0;
    });

    const yaDistribuido = obrasSeleccionadasConMonto.length === obrasSeleccionadas.length;

    const nuevaDistribucion = distribucion.map(d => {
      const idUnico = obtenerIdUnico(d.obra);
      if (obrasSeleccionadas.includes(idUnico)) {
        // Si ya está distribuido, anular (poner en 0), si no, distribuir
        return {
          ...d,
          monto: yaDistribuido ? 0 : montoPorObra,
          porcentaje: yaDistribuido ? 0 : porcentajePorObra
        };
      }
      return { ...d, monto: 0, porcentaje: 0 };
    });

    setDistribucion(nuevaDistribucion);
  }, [cobroSeleccionado, obrasSeleccionadas, distribucion]);

  // Memoizar cálculo de totales para evitar recalcular en cada render
  const totales = useMemo(() => {
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

      if (estaExpandida && distObra) {
        // Si está expandida, sumar los items distribuidos
        const totalItems = parseFloat(distObra.profesionales?.monto || 0) +
                          parseFloat(distObra.materiales?.monto || 0) +
                          parseFloat(distObra.gastosGenerales?.monto || 0);
        totalMonto += totalItems;
      } else {
        // Si no está expandida, usar el monto de la obra
        totalMonto += parseFloat(d.monto);
      }
    });

    const disponible = parseFloat(cobroSeleccionado?.montoDisponible || cobroSeleccionado?.disponible || 1);
    const totalPorcentaje = (totalMonto / disponible) * 100;

    return { totalMonto, totalPorcentaje };
  }, [distribucion, obrasSeleccionadas, distribucionPorObra, obrasExpandidas, cobroSeleccionado]);

  const calcularTotales = useCallback(() => totales, [totales]);

  const toggleObraExpandida = useCallback((presupuestoId) => {
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
  }, [distribucionPorObra]);

  const handleCambiarTipoDistribucionObra = (obraId, tipo) => {
    setTipoDistribucionPorObra(prev => ({
      ...prev,
      [obraId]: tipo
    }));
  };

  const handleDistribucionItemsChange = (obraId, item, campo, valor) => {
    const montoObra = distribucion.find(d => obtenerIdUnico(d.obra) === obraId)?.monto || 0;
    if (montoObra === 0) return;

    const distActual = distribucionPorObra[obraId] || {
      profesionales: { monto: 0, porcentaje: 0 },
      materiales: { monto: 0, porcentaje: 0 },
      gastosGenerales: { monto: 0, porcentaje: 0 }
    };

    let nuevaDist = { ...distActual };

    if (campo === 'monto') {
      const montoNum = parseFloat(valor) || 0;
      const porcentaje = (montoNum / montoObra) * 100;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!cobroSeleccionado) {
      setError('Debe seleccionar un cobro para asignar');
      return;
    }

    // Obtener obras con monto asignado
    const obrasConMonto = distribucion.filter(d => {
      const idUnico = obtenerIdUnico(d.obra);
      return obrasSeleccionadas.includes(idUnico) && parseFloat(d.monto) > 0;
    });

    if (obrasConMonto.length === 0) {
      setError('Debe asignar al menos un monto a una obra');
      return;
    }

    // Validar que el total no exceda el disponible
    const totalAsignar = obrasConMonto.reduce((sum, d) => sum + parseFloat(d.monto), 0);
    const disponible = parseFloat(cobroSeleccionado.montoDisponible || 0);

    if (totalAsignar > disponible) {
      setError(`El total a asignar (${formatearMoneda(totalAsignar)}) excede el saldo disponible (${formatearMoneda(disponible)})`);
      return;
    }

    setLoading(true);

    try {
      // Preparar asignaciones
      const asignaciones = obrasConMonto.map(d => {
        const idUnico = obtenerIdUnico(d.obra);
        const distObra = distribucionPorObra[idUnico];

        // Construir asignación básica
        const asignacion = {
          montoAsignado: parseFloat(d.monto),
          descripcion: `${d.porcentaje.toFixed(1)}% del cobro #${cobroSeleccionado.id} - ${formatearDireccion(d.obra)}`
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

      console.log('🚀 Asignando cobro #' + cobroSeleccionado.id + ' a entidades:', JSON.stringify(asignaciones, null, 2));
      console.log('📊 Entidades con monto:', obrasConMonto.map(d => ({
        tipo: d.obra.tipo,
        idUnico: obtenerIdUnico(d.obra),
        monto: d.monto
      })));
      const resultado = await asignarCobroAObras(cobroSeleccionado.id, asignaciones, empresaSeleccionada.id);
      console.log('✅ Asignación exitosa:', resultado);

      // Registrar en sistema unificado (fire-and-forget) para cada entidad asignada
      const TIPOS_MAP = {
        'OBRA':              'OBRA_PRINCIPAL',
        'OBRA_INDEPENDIENTE': 'OBRA_INDEPENDIENTE',
        'TRABAJO_EXTRA':    'TRABAJO_EXTRA',
        'TRABAJO_ADICIONAL':'TRABAJO_ADICIONAL'
      };
      const fechaHoy = new Date().toISOString().split('T')[0];
      obrasConMonto.forEach(d => {
        const tipoEntidad = TIPOS_MAP[d.obra.tipo] || 'OBRA_PRINCIPAL';
        const entidadId =
          d.obra.tipo === 'OBRA'               ? d.obra.obraId :
          d.obra.tipo === 'OBRA_INDEPENDIENTE' ? (d.obra.obraIndependienteId || d.obra.obraId) :
          d.obra.tipo === 'TRABAJO_EXTRA'      ? d.obra.trabajoExtraId :
          d.obra.tipo === 'TRABAJO_ADICIONAL'  ? d.obra.trabajoAdicionalId : null;

        if (!entidadId) return;

        resolverEntidadFinancieraId(empresaSeleccionada.id, tipoEntidad, entidadId, {
          nombreDisplay: d.obra.nombreObra || d.obra.descripcionObra || null,
          presupuestoNoClienteId: d.obra.presupuestoNoClienteId ?? null
        }).then(efId => {
          if (!efId) return;
          return registrarCobroUnificado({
            entidadFinancieraId: efId,
            empresaId: empresaSeleccionada.id,
            monto: parseFloat(d.monto),
            fechaCobro: cobroSeleccionado.fechaCobro || fechaHoy,
            notas: `Asignación desde cobro #${cobroSeleccionado.id}`
          });
        }).catch(err => {
          console.warn('[SistemaUnificado] Cobro no registrado (backend pendiente de deploy):', err.message);
        });
      });

      // Notificar por cada entidad (solo enviar evento si es obra normal con presupuestoNoClienteId)
      obrasConMonto.forEach(d => {
        if (d.obra.tipo === 'OBRA' && d.obra.presupuestoNoClienteId) {
          eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
            presupuestoId: d.obra.presupuestoNoClienteId,
            monto: parseFloat(d.monto)
          });
        }
      });

      const mensajeExito = `✅ Se asignó ${formatearMoneda(totalAsignar)} del cobro #${cobroSeleccionado.id} a ${obrasConMonto.length} entidad(es)`;
      setSuccessMessage(mensajeExito);

      if (onSuccess) {
        onSuccess({
          mensaje: mensajeExito,
          datos: { total: totalAsignar, cantidad: obrasConMonto.length }
        });
      }

      setTimeout(() => {
        setSuccessMessage(null);
        onHide();
      }, 2000);

    } catch (err) {
      console.error('❌ Error asignando cobro a obras: Error', err.response?.status || 'desconocido');
      console.error('❌ Detalles completos del error:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      console.error('Error asignando cobro:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        `Error ${err.response?.status || ''}: ${err.response?.data?.details || err.message || 'Error al asignar el cobro'}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const { totalMonto, totalPorcentaje } = calcularTotales();

  return (
    <>
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-info text-white">
              <h5 className="modal-title">
                📊 Asignar Saldo Disponible a Obras
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

                {/* Paso 1: Seleccionar Cobro */}
                <div className="card mb-3 border-info">
                  <div className="card-header bg-info text-white">
                    <h6 className="mb-0">📥 Paso 1: Seleccionar Cobro con Saldo</h6>
                  </div>
                  <div className="card-body">
                    {cargandoCobros ? (
                      <div className="text-center py-3">
                        <div className="spinner-border text-info" role="status"></div>
                        <p className="mt-2 text-muted">Cargando cobros...</p>
                      </div>
                    ) : cobrosDisponibles.length === 0 ? (
                      <>
                        <div className="alert alert-warning">
                          <i className="bi bi-info-circle"></i> No hay cobros con saldo disponible para asignar a nuevas obras
                        </div>

                        {/* 🆕 Mostrar asignaciones existentes con saldo sin distribuir */}
                        {asignacionesExistentes.length > 0 && (
                          <div className="mt-3">
                            <div className="alert alert-info">
                              <strong><i className="bi bi-info-circle me-2"></i>Asignaciones con Saldo Sin Distribuir:</strong>
                              <p className="mb-0 mt-2">
                                Tienes {asignacionesExistentes.length} obra(s) con dinero asignado que no ha sido distribuido en ítems específicos.
                              </p>
                            </div>

                            <table className="table table-sm table-hover">
                              <thead className="table-light">
                                <tr>
                                  <th>Obra</th>
                                  <th className="text-end">Total Asignado</th>
                                  <th className="text-end">Distribuido</th>
                                  <th className="text-end">Sin Distribuir</th>
                                  <th className="text-center">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {asignacionesExistentes.map((obra, idx) => {
                                  const totalAsignado = obra.totalCobradoAsignado || 0;
                                  const totalDistribuido = (obra.montoProfesionales || 0) +
                                                          (obra.montoMateriales || 0) +
                                                          (obra.montoGastosGenerales || 0);
                                  const sinDistribuir = totalAsignado - totalDistribuido;

                                  return (
                                    <tr key={idx}>
                                      <td><strong>{obra.nombreObra}</strong></td>
                                      <td className="text-end text-success fw-bold">
                                        {formatearMoneda(totalAsignado)}
                                      </td>
                                      <td className="text-end text-primary">
                                        {formatearMoneda(totalDistribuido)}
                                      </td>
                                      <td className="text-end text-warning fw-bold">
                                        {formatearMoneda(sinDistribuir)}
                                      </td>
                                      <td className="text-center">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-primary"
                                          onClick={() => {
                                            setEditandoAsignacion(obra);
                                            setFormEdicionAsignacion({
                                              montoProfesionales: obra.montoProfesionales || 0,
                                              montoMateriales: obra.montoMateriales || 0,
                                              montoGastosGenerales: obra.montoGastosGenerales || 0
                                            });
                                          }}
                                        >
                                          <i className="bi bi-pencil-square me-1"></i>
                                          Distribuir en Ítems
                                        </button>
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
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead className="table-light">
                            <tr>
                              <th width="50"></th>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th className="text-end">Monto Total</th>
                              <th className="text-end">Asignado</th>
                              <th className="text-end">Disponible</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cobrosDisponibles.map(cobro => {
                              const isSelected = cobroSeleccionado?.id === cobro.id;
                              return (
                                <tr
                                  key={cobro.id}
                                  className={isSelected ? 'table-info' : ''}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => handleSeleccionarCobro(cobro)}
                                >
                                  <td>
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      checked={isSelected}
                                      onChange={() => handleSeleccionarCobro(cobro)}
                                    />
                                  </td>
                                  <td>{formatearFecha(cobro.fechaCobro)}</td>
                                  <td>
                                    <small>{cobro.descripcion || 'Sin descripción'}</small>
                                    {cobro.metodoPago && (
                                      <span className="badge bg-secondary ms-2">{cobro.metodoPago}</span>
                                    )}
                                  </td>
                                  <td className="text-end">{formatearMoneda(cobro.montoTotal)}</td>
                                  <td className="text-end text-muted">{formatearMoneda(cobro.montoAsignado || 0)}</td>
                                  <td className="text-end">
                                    <strong className="text-success">{formatearMoneda(cobro.montoDisponible)}</strong>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Asignaciones actuales del cobro seleccionado */}
                {cobroSeleccionado && (
                  <div className="card mb-3 border-info">
                    <div className="card-header bg-info text-white">
                      <h6 className="mb-0">📋 Asignaciones Actuales</h6>
                    </div>
                    <div className="card-body">
                      {cargandoAsignaciones ? (
                        <div className="text-center text-muted">
                          <div className="spinner-border spinner-border-sm me-2"></div>
                          Cargando asignaciones...
                        </div>
                      ) : asignacionesActuales.length === 0 ? (
                        <p className="text-muted mb-0">Este cobro aún no tiene asignaciones</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr>
                                <th>Obra</th>
                                <th className="text-end">Monto</th>
                                <th className="text-end">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {asignacionesActuales.map((asig) => (
                                <tr key={asig.id}>
                                  <td>
                                    <small>
                                      {asig.direccionObraCalle} {asig.direccionObraAltura}
                                      {asig.direccionObraBarrio && `, ${asig.direccionObraBarrio}`}
                                    </small>
                                  </td>
                                  <td className="text-end">{formatearMoneda(asig.monto)}</td>
                                  <td className="text-end">
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleEliminarAsignacion(asig.id)}
                                      title="Eliminar asignación"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paso 2: Distribuir entre Obras */}
                {cobroSeleccionado && (
                  <div className="card mb-3 border-success">
                    <div className="card-header bg-success text-white">
                      <h6 className="mb-0">
                        📊 Paso 2: Distribuir {formatearMoneda(cobroSeleccionado.montoDisponible)} entre Obras
                      </h6>
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
                              disabled={obrasSeleccionadas.length === 0}
                            >
                              <i className="bi bi-distribute-vertical"></i> Distribuir a Todas las Obras por Igual
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
                                  <th>Obra</th>
                                  <th width="120" className="text-end text-muted">
                                    <div className="d-flex flex-column align-items-end">
                                      <span>💼 Jornales</span>
                                      <small style={{fontSize: '0.65rem', fontWeight: 'normal'}}>(Presup. Base)</small>
                                    </div>
                                  </th>
                                  <th width="120" className="text-end text-muted">
                                    <div className="d-flex flex-column align-items-end">
                                      <span>🔨 Materiales</span>
                                      <small style={{fontSize: '0.65rem', fontWeight: 'normal'}}>(Presup. Base)</small>
                                    </div>
                                  </th>
                                  <th width="120" className="text-end text-muted">
                                    <div className="d-flex flex-column align-items-end">
                                      <span>💰 Gastos Gral.</span>
                                      <small style={{fontSize: '0.65rem', fontWeight: 'normal'}}>(Presup. Base)</small>
                                    </div>
                                  </th>
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
                                            borderLeft: d.obra.esNieto ? '7px solid #fd7e14' : d.obra.esHijo ? '5px solid #ffc107' : 'none',
                                            borderBottom: (d.obra.esNieto || d.obra.esHijo) ? '1px solid rgba(253, 126, 20, 0.45)' : undefined
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
                                                Mostrar Secciones
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
                                                  <span className="badge bg-primary" style={{fontSize: '0.65rem'}}>🔧 Tarea Leve / Mantenimiento</span>
                                                )}
                                                {d.obra.tipo === 'TRABAJO_EXTRA' && (
                                                  <>
                                                    <span className="badge bg-info" style={{fontSize: '0.65rem'}}>📋 Adicional Obra</span>
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
                                        <td className="text-end text-muted">
                                          <small className="fw-bold">
                                            {d.obra.totalJornales > 0 ? `$${d.obra.totalJornales.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : '-'}
                                          </small>
                                        </td>
                                        <td className="text-end text-muted">
                                          <small className="fw-bold">
                                            {d.obra.totalMateriales > 0 ? `$${d.obra.totalMateriales.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : '-'}
                                          </small>
                                        </td>
                                        <td className="text-end text-muted">
                                          <small className="fw-bold">
                                            {d.obra.totalGastosGenerales > 0 ? `$${d.obra.totalGastosGenerales.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : '-'}
                                          </small>
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

                                      {/* Desglose por rubros cuando está expandido */}
                                      {isExpanded && d.obra.itemsCalculadora && d.obra.itemsCalculadora.length > 0 && (
                                        <tr className="bg-light">
                                          <td colSpan="2" className="ps-5">
                                            <small className="text-muted fst-italic">
                                              <i className="bi bi-caret-right-fill me-1"></i>
                                              Desglose por rubros:
                                            </small>
                                          </td>
                                          <td colSpan="6" className="py-1">
                                            <div style={{fontSize: '0.75rem'}}>
                                              {/* Header del desglose */}
                                              <div className="d-flex align-items-center mb-1 fw-bold text-muted" style={{fontSize: '0.7rem'}}>
                                                <span className="me-3" style={{minWidth: '100px'}}>Rubro</span>
                                                <span className="me-3" style={{minWidth: '120px'}}>💼 Jornales</span>
                                                <span className="me-3" style={{minWidth: '120px'}}>🔨 Materiales</span>
                                                <span style={{minWidth: '120px'}}>💰 Gastos Gral.</span>
                                              </div>
                                              {/* Items */}
                                              {d.obra.itemsCalculadora.map((item, idx) => (
                                                <div key={idx} className="d-flex align-items-center mb-1">
                                                  <span className="text-muted me-3" style={{minWidth: '100px'}}>
                                                    {item.tipoProfesional || item.descripcion || `Rubro ${idx + 1}`}:
                                                  </span>
                                                  <span className="me-3" style={{minWidth: '120px'}}>
                                                    ${(item.subtotalManoObra || 0).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                                  </span>
                                                  <span className="me-3" style={{minWidth: '120px'}}>
                                                    ${(item.subtotalMateriales || 0).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                                  </span>
                                                  <span style={{minWidth: '120px'}}>
                                                    ${(item.subtotalGastosGenerales || 0).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </td>
                                        </tr>
                                      )}

                                      {/* Distribución por ítems de esta obra */}
                                      {isExpanded && isSelected && permiteItems && (() => {
                                        const obraId = idUnico; // ID único para esta obra
                                        return (
                                        <tr className={isSelected ? 'table-success' : ''}>
                                          <td colSpan="8" className="p-0">
                                            <div className="bg-light border-top" style={{padding: '12px 20px'}}>
                                              <div className="d-flex justify-content-between align-items-center mb-2">
                                                <small className="text-muted fw-bold">
                                                  <i className="bi bi-box me-1"></i>
                                                  Distribuir {formatearMoneda(d.monto)} entre ítems
                                                </small>
                                                <div className="btn-group btn-group-sm" role="group">
                                                  <button
                                                    type="button"
                                                    className={`btn btn-sm ${(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                    onClick={() => handleCambiarTipoDistribucionObra(obraId, 'MONTO')}
                                                  >
                                                    Por Monto
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={`btn btn-sm ${(tipoDistribucionPorObra[obraId] || 'MONTO') === 'PORCENTAJE' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                    onClick={() => handleCambiarTipoDistribucionObra(obraId, 'PORCENTAJE')}
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
                                                        placeholder={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.profesionales?.monto || '')
                                                          : (distObra?.profesionales?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          obraId,
                                                          'profesionales',
                                                          (tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO'
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
                                                        placeholder={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.materiales?.monto || '')
                                                          : (distObra?.materiales?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          obraId,
                                                          'materiales',
                                                          (tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO'
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
                                                        placeholder={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.gastosGenerales?.monto || '')
                                                          : (distObra?.gastosGenerales?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          obraId,
                                                          'gastosGenerales',
                                                          (tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[obraId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[obraId] || 'MONTO') === 'MONTO'
                                                          ? `${(distObra?.gastosGenerales?.porcentaje || 0).toFixed(2)}%`
                                                          : formatearMoneda(parseFloat(distObra?.gastosGenerales?.monto || 0))
                                                        }
                                                      </small>
                                                    </div>
                                                  </div>
                                                </div>

                                              </div>

                                              {/* Indicador visual del total distribuido */}
                                              <div className="mt-3 p-2 bg-light rounded">
                                                <div className="d-flex justify-content-between align-items-center">
                                                  <span className="fw-bold">Total distribuido:</span>
                                                  <span className="fw-bold">{formatearMoneda(
                                                    (distObra?.profesionales?.monto || 0) +
                                                    (distObra?.materiales?.monto || 0) +
                                                    (distObra?.gastosGenerales?.monto || 0)
                                                  )}</span>
                                                </div>
                                                {(() => {
                                                  const totalDistribuido = (distObra?.profesionales?.monto || 0) +
                                                    (distObra?.materiales?.monto || 0) +
                                                    (distObra?.gastosGenerales?.monto || 0);
                                                  const falta = d.monto - totalDistribuido;

                                                  if (Math.abs(falta) < 0.01) {
                                                    return (
                                                      <div className="text-success mt-1">
                                                        <i className="bi bi-check-circle-fill me-1"></i>
                                                        Distribución completa
                                                      </div>
                                                    );
                                                  } else if (falta > 0) {
                                                    return (
                                                      <div className="text-danger mt-1">
                                                        <i className="bi bi-exclamation-circle-fill me-1"></i>
                                                        Falta: {formatearMoneda(falta)}
                                                      </div>
                                                    );
                                                  } else {
                                                    return (
                                                      <div className="text-warning mt-1">
                                                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                                        Excede: {formatearMoneda(Math.abs(falta))}
                                                      </div>
                                                    );
                                                  }
                                                })()}
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
                              <tfoot>
                                <tr className="table-dark">
                                  <td colSpan="5"><strong>TOTAL A ASIGNAR</strong></td>
                                  <td className="text-end"><strong>{formatearMoneda(totalMonto)}</strong></td>
                                  <td className="text-end"><strong>{totalPorcentaje.toFixed(2)}%</strong></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {totalMonto > parseFloat(cobroSeleccionado.montoDisponible) && (
                            <div className="alert alert-danger mt-2">
                              <i className="bi bi-exclamation-triangle"></i> El total asignado excede el saldo disponible
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-info text-white"
                  disabled={loading || !cobroSeleccionado || obrasSeleccionadas.length === 0}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Asignando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i> Asignar Saldo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 🆕 Modal de Edición de Distribución de Ítems */}
      {editandoAsignacion && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-pencil-square me-2"></i>
                  Distribuir en Ítems: {editandoAsignacion.nombreObra}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setEditandoAsignacion(null)}
                  disabled={guardandoAsignacion}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <strong>Total Asignado:</strong> {formatearMoneda(editandoAsignacion.totalCobradoAsignado || 0)}
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      👷 Profesionales
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicionAsignacion.montoProfesionales}
                      onChange={(e) => setFormEdicionAsignacion({...formEdicionAsignacion, montoProfesionales: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardandoAsignacion}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      🧱 Materiales
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicionAsignacion.montoMateriales}
                      onChange={(e) => setFormEdicionAsignacion({...formEdicionAsignacion, montoMateriales: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardandoAsignacion}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      💵 Gastos Generales
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicionAsignacion.montoGastosGenerales}
                      onChange={(e) => setFormEdicionAsignacion({...formEdicionAsignacion, montoGastosGenerales: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardandoAsignacion}
                    />
                  </div>
                </div>

                <div className="alert alert-warning mt-3">
                  <strong>Total a Distribuir:</strong> {formatearMoneda(
                    formEdicionAsignacion.montoProfesionales +
                    formEdicionAsignacion.montoMateriales +
                    formEdicionAsignacion.montoGastosGenerales
                  )}
                  <br />
                  {(formEdicionAsignacion.montoProfesionales + formEdicionAsignacion.montoMateriales +
                    formEdicionAsignacion.montoGastosGenerales) >
                   (editandoAsignacion.totalCobradoAsignado || 0) && (
                    <span className="text-danger">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Excede el total asignado
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditandoAsignacion(null)}
                  disabled={guardandoAsignacion}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const totalDistribuido = formEdicionAsignacion.montoProfesionales +
                                            formEdicionAsignacion.montoMateriales +
                                            formEdicionAsignacion.montoGastosGenerales;

                    if (totalDistribuido > (editandoAsignacion.totalCobradoAsignado || 0)) {
                      setError('El total distribuido no puede exceder el total asignado');
                      return;
                    }

                    setGuardandoAsignacion(true);
                    try {
                      console.log('🔍 Editando asignación, objeto completo:', editandoAsignacion);

                      // Obtener todas las asignaciones de esta obra
                      const asignacionesObra = await obtenerAsignacionesDeObra(editandoAsignacion.obraId, empresaSeleccionada.id);
                      console.log('📋 Asignaciones de la obra:', asignacionesObra);

                      if (!asignacionesObra || asignacionesObra.length === 0) {
                        throw new Error('No se encontraron asignaciones para esta obra');
                      }

                      // Actualizar TODAS las asignaciones de la obra con la nueva distribución
                      await Promise.all(
                        asignacionesObra.map(asignacion =>
                          actualizarAsignacion(
                            asignacion.id,
                            {
                              // Mantener campos obligatorios de la asignación original
                              montoAsignado: asignacion.montoAsignado,
                              obraId: asignacion.obraId,
                              cobroObraId: asignacion.cobroObraId,
                              presupuestoNoClienteId: asignacion.presupuestoNoClienteId,
                              // Actualizar distribución por ítems
                              montoProfesionales: formEdicionAsignacion.montoProfesionales,
                              montoMateriales: formEdicionAsignacion.montoMateriales,
                              montoGastosGenerales: formEdicionAsignacion.montoGastosGenerales,
                              // Calcular porcentajes
                              porcentajeProfesionales: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoProfesionales / asignacion.montoAsignado * 100)
                                : 0,
                              porcentajeMateriales: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoMateriales / asignacion.montoAsignado * 100)
                                : 0,
                              porcentajeGastosGenerales: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoGastosGenerales / asignacion.montoAsignado * 100)
                                : 0
                            },
                            empresaSeleccionada.id
                          )
                        )
                      );

                      // Recargar asignaciones
                      await cargarAsignacionesExistentes();
                      setEditandoAsignacion(null);
                      setSuccessMessage('Distribución actualizada correctamente');

                      // Notificar cambios financieros
                      eventBus.emit(FINANCIAL_EVENTS.COBRO_ACTUALIZADO);

                      if (onSuccess) {
                        onSuccess();
                      }
                    } catch (error) {
                      console.error('Error al actualizar distribución:', error);
                      setError('Error al actualizar la distribución: ' + (error.message || 'Error desconocido'));
                    } finally {
                      setGuardandoAsignacion(false);
                    }
                  }}
                  disabled={guardandoAsignacion}
                >
                  {guardandoAsignacion ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Guardar Distribución
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default AsignarCobroDisponibleModal;
