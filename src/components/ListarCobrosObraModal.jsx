import React, { useState, useEffect } from 'react';
import {
  listarCobrosPorObra,
  marcarComoCobrado,
  anularCobro,
  eliminarCobro,
  obtenerTotalCobrado,
  obtenerTotalPendiente,
  formatearMoneda,
  formatearFecha,
  obtenerEstadoCobro,
  estaVencido
} from '../services/cobrosObraService';
import { obtenerAsignacionesDeCobro } from '../services/asignacionesCobroObraService';
import { useEmpresa } from '../EmpresaContext';
import DireccionObraSelector from './DireccionObraSelector';
import api from '../services/api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

const ListarCobrosObraModal = ({ show, onHide, onSuccess, obraDireccion, modoConsolidado, obrasSeleccionadas, obrasDisponibles, trabajosExtraSeleccionados, trabajosAdicionalesSeleccionados, trabajosAdicionalesDisponibles, refreshTrigger }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [cobros, setCobros] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(obraDireccion || null);
  const [totalPresupuesto, setTotalPresupuesto] = useState(0);
  const [totalCobrado, setTotalCobrado] = useState(0);
  const [totalPendiente, setTotalPendiente] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Determinar si hay selección parcial
  const haySeleccionParcial = modoConsolidado && obrasSeleccionadas && obrasSeleccionadas.size > 0;

  useEffect(() => {
    if (obraDireccion) {
      setDireccionSeleccionada(obraDireccion);
    }
  }, [obraDireccion]);

  // Auto-actualización cuando el modal se abre o cambian los datos del presupuesto
  useEffect(() => {
    if (show && empresaSeleccionada) {
      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else if (direccionSeleccionada) {
        cargarCobros();
      }
    }
  }, [show, direccionSeleccionada, empresaSeleccionada, modoConsolidado, refreshTrigger]);

  const cargarCobrosConsolidados = async () => {
    setLoading(true);
    setError(null);
    try {
      // Usar obrasDisponibles que ya viene con la estructura correcta
      let obrasACargar = obrasDisponibles || [];


      // Filtrar según selección
      if (haySeleccionParcial && obrasSeleccionadas && obrasSeleccionadas.size > 0) {
        const idsSeleccionados = Array.from(obrasSeleccionadas);
        obrasACargar = obrasACargar.filter(o => idsSeleccionados.includes(o.id));
      }

      // Filtrar trabajos extra SOLO si hay selección específica de trabajos extra
      // Si no hay selección específica, mantener TODOS los trabajos extra de las obras seleccionadas
      if (haySeleccionParcial && trabajosExtraSeleccionados && trabajosExtraSeleccionados.size > 0) {
        const idsSeleccionados = Array.from(trabajosExtraSeleccionados);
        obrasACargar = obrasACargar.map(obra => {
          if (obra.trabajosExtra && obra.trabajosExtra.length > 0) {
            const trabajosExtraFiltrados = obra.trabajosExtra.filter(te =>
              idsSeleccionados.includes(te.id)
            );
            return { ...obra, trabajosExtra: trabajosExtraFiltrados };
          }
          return obra;
        });
      }

      // Usar trabajosAdicionalesDisponibles que ya viene cargado
      let taList = trabajosAdicionalesDisponibles || [];
      if (haySeleccionParcial && trabajosAdicionalesSeleccionados && trabajosAdicionalesSeleccionados.size > 0) {
        const idsSeleccionados = Array.from(trabajosAdicionalesSeleccionados);
        taList = taList.filter(ta => idsSeleccionados.includes(ta.id));
      }

      // Cargar estadísticas para trabajos adicionales
      let efStatsMap = {};
      let taOiEFs = [];
      let getEFStats = () => null;
      let trabajosAdicionalesPorObraId = {};
      let trabajosAdicionalesPorTrabajoExtraObraId = {};
      let trabajosAdicionalesHuerfanos = [];

      try {
        const efService = await import('../services/entidadesFinancierasService');
        const todasEFs = await efService.listarEntidadesFinancieras(empresaSeleccionada.id, true);
        taOiEFs = (Array.isArray(todasEFs) ? todasEFs : []).filter(ef =>
          ef.tipoEntidad === 'TRABAJO_ADICIONAL' || ef.tipoEntidad === 'OBRA_INDEPENDIENTE'
        );
        const taOiIds = taOiEFs.map(ef => ef.id).filter(Boolean);
        if (taOiIds.length > 0) {
          const stats = await efService.obtenerEstadisticasMultiples(empresaSeleccionada.id, taOiIds);
          (Array.isArray(stats) ? stats : []).forEach(s => { efStatsMap[s.entidadFinancieraId] = s; });
        }

        getEFStats = (tipo, entidadId) => {
          const ef = taOiEFs.find(e => e.tipoEntidad === tipo && Number(e.entidadId) === Number(entidadId));
          return ef ? (efStatsMap[ef.id] || null) : null;
        };

        // Crear mapa de trabajos adicionales por obraId y trabajoExtraId
        // NOTA: trabajoExtraId NO apunta a trabajos extra de presupuesto, sino a otros TAs
        // formando una jerarquía. Por ahora, agrupar todos los TAs por obraId solamente.
        taList.forEach(ta => {
          const stats = getEFStats('TRABAJO_ADICIONAL', ta.id);
          const taData = {
            id: `ta_${ta.id}`,
            taId: ta.id,
            tipo: 'TRABAJO_ADICIONAL',
            nombre: ta.nombre || ta.descripcion || `Trabajo Adicional #${ta.id}`,
            presupuesto: parseFloat(ta.importe || ta.montoTotal || ta.total || ta.monto || 0),
            cobros: [],
            totalCobrado: parseFloat(stats?.totalCobrado || 0),
            obraId: ta.obraId,
            trabajoExtraId: ta.trabajoExtraId,
          };

          // Agrupar solo por obraId (trabajoExtraId apunta a otros TAs, no a TEs)
          if (ta.obraId) {
            if (!trabajosAdicionalesPorObraId[ta.obraId]) {
              trabajosAdicionalesPorObraId[ta.obraId] = [];
            }
            trabajosAdicionalesPorObraId[ta.obraId].push(taData);
          } else {
            trabajosAdicionalesHuerfanos.push(taData);
          }
        });
      } catch (err) {
        console.warn('⚠️ Error cargando estadísticas de trabajos adicionales:', err.message);
      }

      // 2. Cargar cobros directos de cada obra
      const promesasCobros = obrasACargar.map(obra =>
        listarCobrosPorObra({
          presupuestoNoClienteId: obra.id,
          calle: obra.direccionObraCalle,
          altura: obra.direccionObraAltura,
          barrio: obra.direccionObraBarrio,
          torre: obra.direccionObraTorre,
          piso: obra.direccionObraPiso,
          depto: obra.direccionObraDepto
        }, empresaSeleccionada.id)
          .then(cobros => ({ obra, cobros: Array.isArray(cobros) ? cobros : [] }))
          .catch(err => {
            console.warn(`⚠️ Error cargando cobros de obra ${obra.nombreObra}:`, err.message);
            return { obra, cobros: [] };
          })
      );

      const resultados = await Promise.all(promesasCobros);

      // Combinar todos los cobros
      let cobrosObra = [];
      resultados.forEach(({ obra, cobros }) => {
        const cobrosEnriquecidos = cobros.map(c => ({
          ...c,
          tipo: 'OBRA',
          nombreObra: obra.nombreObra
        }));
        cobrosObra = [...cobrosObra, ...cobrosEnriquecidos];
      });

      // 3. Cargar cobros a la empresa (Gisel, etc.)
      let cobrosEmpresa = [];
      let totalCobradoEmpresa = 0;
      try {
        const { listarCobrosEmpresa, obtenerResumenCobrosEmpresa } = await import('../services/cobrosEmpresaService');

        // Obtener total
        const resumen = await obtenerResumenCobrosEmpresa(empresaSeleccionada.id);
        totalCobradoEmpresa = parseFloat(resumen?.totalCobrado || 0);

        // Obtener lista de cobros
        const cobrosEmp = await listarCobrosEmpresa(empresaSeleccionada.id);
        cobrosEmpresa = (Array.isArray(cobrosEmp) ? cobrosEmp : []).map(c => ({
          ...c,
          monto: c.montoTotal || c.monto || 0, // Normalizar campo monto
          tipo: 'EMPRESA',
          nombreObra: `Cobro a ${empresaSeleccionada.razonSocial || 'Empresa'}`
        }));
      } catch (error) {
        console.warn('⚠️ Error obteniendo cobros empresa:', error.message);
        totalCobradoEmpresa = 0;
      }

      // 4. Cargar asignaciones de cobros empresa a las obras seleccionadas
      let totalAsignacionesObras = 0;
      try {
        const { obtenerDistribucionPorObra } = await import('../services/cobrosEmpresaService');
        const distribucion = await obtenerDistribucionPorObra(empresaSeleccionada.id);

        if (distribucion && Array.isArray(distribucion)) {
          const idsObras = obrasACargar.map(o => o.id);
          distribucion.forEach(dist => {
            if (dist.obraId && idsObras.includes(dist.obraId)) {
              totalAsignacionesObras += parseFloat(dist.totalAsignado || 0);
            }
          });
        }
      } catch (error) {
        console.warn('⚠️ Error cargando distribución cobros empresa:', error.message);
      }

      // 5. Combinar cobros de obra + cobros empresa
      const todosCobros = [...cobrosObra, ...cobrosEmpresa];

      // Cargar asignaciones de ítems para cada cobro
      const cobrosConAsignaciones = await Promise.all(
        todosCobros.map(async (cobro) => {
          try {
            // Para cobros de empresa, no hay asignaciones por ítems
            // (se asignan completos a obras, no se distribuyen por profesionales/materiales)
            if (cobro.tipo === 'EMPRESA') {
              return {
                ...cobro,
                asignaciones: [] // Los cobros empresa no tienen distribución por ítems
              };
            }

            // Para cobros de obra, sí hay asignaciones por ítems
            const asignaciones = await obtenerAsignacionesDeCobro(cobro.id, empresaSeleccionada.id);
            return {
              ...cobro,
              asignaciones: asignaciones || []
            };
          } catch (error) {
            console.error(`⚠️ Error cargando asignaciones para cobro ${cobro.id}:`, error);
            return {
              ...cobro,
              asignaciones: []
            };
          }
        })
      );

      setCobros(cobrosConAsignaciones);

      // Cargar Obras Independientes
      let obrasIndependientes = [];
      try {
        const oiRaw = await api.obras.getObrasManuales(empresaSeleccionada.id);
        obrasIndependientes = (Array.isArray(oiRaw) ? oiRaw : oiRaw?.data || oiRaw?.datos || []).filter(o =>
          !o.presupuestoNoClienteId && !o.presupuestoId
        );
        if (haySeleccionParcial && obrasSeleccionadas && obrasSeleccionadas.size > 0) {
          const idsSeleccionados = Array.from(obrasSeleccionadas);
          obrasIndependientes = obrasIndependientes.filter(oi => idsSeleccionados.includes(oi.id));
        }
      } catch (err) {
        console.warn('⚠️ Error cargando obras independientes:', err.message);
      }

      // 5b. Construir lista de entidades (TODAS las categorías con cobrados reales)
      {
        const cobrosDeObraPorNombre = {};
        cobrosConAsignaciones.filter(c => c.tipo === 'OBRA').forEach(c => {
          const key = c.nombreObra;
          if (!cobrosDeObraPorNombre[key]) cobrosDeObraPorNombre[key] = [];
          cobrosDeObraPorNombre[key].push(c);
        });
        const cobrosEmpresaItems = cobrosConAsignaciones.filter(c => c.tipo === 'EMPRESA');

        // Obras principales (con presupuesto) + sus trabajos extra
        const entidadesBase = obrasACargar.flatMap(obra => {
          const cobrosObra = cobrosDeObraPorNombre[obra.nombreObra] || [];
          const obraEnt = {
            id: obra.id, // ID del presupuesto
            obraId: obra.obraId, // ID de la tabla obras
            tipo: 'OBRA_PRINCIPAL',
            nombre: obra.nombreObra,
            presupuesto: parseFloat(obra.totalPresupuesto || 0) +
              (obra.trabajosExtra?.reduce((s, te) => s + (te.totalCalculado || 0), 0) || 0),
            cobros: cobrosObra,
            totalCobrado: cobrosObra.reduce((s, c) => s + parseFloat(c.monto || 0), 0),
          };
          const teEnt = (obra.trabajosExtra || []).map(te => {
            return {
              id: `te_${te.id}`, // Prefijo para evitar colisiones
              presupuestoId: te.id, // ID del presupuesto del trabajo extra
              obraId: te.obraId, // ID de la tabla obras del trabajo extra
              tipo: 'TRABAJO_EXTRA',
              nombre: te.nombre || `Trabajo Extra #${te.id}`,
              presupuesto: parseFloat(te.totalCalculado || te.totalFinal || 0),
              cobros: [],
              totalCobrado: 0,
              obraPadreNombre: obra.nombreObra,
              obraPadreObraId: obra.obraId, // Para referencia
            };
          });
          return [obraEnt, ...teEnt];
        });
        // Cobros empresa
        if (cobrosEmpresaItems.length > 0) {
          entidadesBase.push({
            id: 'empresa',
            tipo: 'EMPRESA',
            nombre: empresaSeleccionada?.razonSocial || 'Empresa',
            presupuesto: 0,
            cobros: cobrosEmpresaItems,
            totalCobrado: cobrosEmpresaItems.reduce((s, c) => s + parseFloat(c.monto || 0), 0),
          });
        }
        // 🆕 Obras Independientes (circuito cobros_entidad) con cobrado real de EF stats
        obrasIndependientes.forEach(oi => {
          const stats = getEFStats('OBRA_INDEPENDIENTE', oi.id);
          entidadesBase.push({
            id: `oi_${oi.id}`,
            tipo: 'OBRA_INDEPENDIENTE',
            nombre: oi.nombre || oi.direccion || `Obra Independiente #${oi.id}`,
            presupuesto: parseFloat(oi.presupuestoEstimado || oi.presupuesto || 0),
            cobros: [],
            totalCobrado: parseFloat(stats?.totalCobrado || 0),
          });
        });

        // Agregar trabajos adicionales a sus obras correspondientes
        entidadesBase.forEach(entidad => {
          const esObraPrincipal = entidad.tipo === 'OBRA_PRINCIPAL';
          const tieneObraId = Boolean(entidad.obraId);

          if (esObraPrincipal && tieneObraId) {
            // Todos los TAs que pertenecen a esta obra (convertir obraId a string para la búsqueda)
            const obraIdKey = String(entidad.obraId);
            const tasAsignados = trabajosAdicionalesPorObraId[obraIdKey] || [];
            entidad.trabajosAdicionales = tasAsignados;
          }
        });

        // Agregar trabajos adicionales huérfanos como entidades independientes
        trabajosAdicionalesHuerfanos.forEach(ta => entidadesBase.push(ta));

        setEntidades(entidadesBase);
      }

      // 5. Calcular totales
      // Total Cobrado = cobros empresa (circuito viejo) + cobros TA/OI (circuito nuevo)
      const totalCobradoTAOI = Object.values(efStatsMap)
        .reduce((sum, s) => sum + parseFloat(s.totalCobrado || 0), 0);
      const totalCobradoCalculado = totalCobradoEmpresa + totalCobradoTAOI;

      const totalPresupuestoCalculado =
        // Obras principales + sus trabajos extra
        obrasACargar.reduce((sum, obra) => {
          let presupuesto = parseFloat(
            obra.totalPresupuesto ||
            obra.totalFinal ||
            obra.totalPresupuestoConHonorarios ||
            obra.presupuestoCompleto?.totalFinal ||
            obra.presupuestoCompleto?.totalPresupuestoConHonorarios ||
            obra.presupuestoCompleto?.montoTotal ||
            0
          );
          if (obra.trabajosExtra && Array.isArray(obra.trabajosExtra)) {
            presupuesto += obra.trabajosExtra.reduce((s, te) =>
              s + (parseFloat(te.totalCalculado) || parseFloat(te.totalFinal) || 0), 0);
          }
          return sum + presupuesto;
        }, 0) +
        // 🆕 Obras Independientes
        obrasIndependientes.reduce((sum, oi) =>
          sum + parseFloat(oi.presupuestoEstimado || oi.presupuesto || 0), 0) +
        // 🆕 Trabajos Adicionales
        taList.reduce((sum, ta) =>
          sum + parseFloat(ta.importe || ta.montoTotal || ta.total || ta.monto || 0), 0);

      const pendienteCalculado = totalPresupuestoCalculado - totalCobradoCalculado;

      setTotalCobrado(totalCobradoCalculado);
      setTotalPendiente(pendienteCalculado > 0 ? pendienteCalculado : 0);
      setTotalPresupuesto(totalPresupuestoCalculado);
    } catch (err) {
      console.error('❌ Error cargando cobros consolidados:', err);
      console.error('❌ Stack:', err.stack);
      // Si el error es 404 (no encontrado), no mostrar error, solo dejar vacío
      if (err.response?.status === 404 || err.response?.status === 204) {
        console.log('ℹ️ No hay cobros registrados para esta empresa');
        setCobros([]);
        setTotalCobrado(0);
        setTotalPendiente(0);
        setTotalPresupuesto(0);
      } else {
        // Solo mostrar error si es un error real del servidor
        setError(`Error al cargar cobros: ${err.message}`);
        setCobros([]);
        setTotalCobrado(0);
        setTotalPendiente(0);
        setTotalPresupuesto(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const cargarCobros = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!direccionSeleccionada?.presupuestoNoClienteId) {
        setCobros([]);
        setTotalPresupuesto(0);
        setTotalCobrado(0);
        setTotalPendiente(0);
        setLoading(false);
        return;
      }

      // Cargar el presupuesto para obtener el total
      const presupuestoResponse = await api.presupuestosNoCliente.getById(
        direccionSeleccionada.presupuestoNoClienteId,
        empresaSeleccionada.id
      );

      const presupuesto = presupuestoResponse?.datos || presupuestoResponse?.data || presupuestoResponse;
      const totalPpto = presupuesto?.totalPresupuestoConHonorarios || presupuesto?.totalPresupuesto || 0;

      setTotalPresupuesto(totalPpto);

      // Cargar cobros
      const data = await listarCobrosPorObra(direccionSeleccionada, empresaSeleccionada.id);
      const cobrosArray = Array.isArray(data) ? data : [];
      setCobros(cobrosArray);

      // Calcular total cobrado (solo cobros en estado COBRADO)
      const cobrado = cobrosArray
        .filter(c => c.estado === 'COBRADO')
        .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

      // Total pendiente = Total del presupuesto - Total cobrado
      const pendiente = totalPpto - cobrado;

      setTotalCobrado(cobrado);
      setTotalPendiente(pendiente);
    } catch (err) {
      console.error('❌ Error cargando cobros:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Error desconocido';
      setError(`Error al cargar cobros: ${errorMsg}. Por favor intente nuevamente.`);
      setCobros([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarTotales = async () => {
    try {
      const [cobrado, pendiente] = await Promise.all([
        obtenerTotalCobrado(direccionSeleccionada, empresaSeleccionada.id),
        obtenerTotalPendiente(direccionSeleccionada, empresaSeleccionada.id)
      ]);
      setTotalCobrado(cobrado || 0);
      setTotalPendiente(pendiente || 0);
    } catch (err) {
      console.error('Error cargando totales:', err);
    }
  };

  const handleMarcarCobrado = async (cobroId) => {
    const confirmar = window.confirm('¿Confirmar que este cobro fue efectivamente cobrado?');
    if (!confirmar) return;

    try {
      await marcarComoCobrado(cobroId, null, empresaSeleccionada.id);

      // 📡 Notificar al contexto centralizado
      const cobro = cobros.find(c => c.id === cobroId);
      if (cobro) {
        eventBus.emit(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, {
          presupuestoId: cobro.presupuestoNoClienteId,
          cobroId
        });
      }

      if (onSuccess) {
        onSuccess({
          mensaje: '✅ Cobro marcado como cobrado exitosamente'
        });
      }

      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else {
        cargarCobros();
      }
    } catch (err) {
      console.error('Error marcando cobro:', err);
      alert('Error al marcar cobro como cobrado');
    }
  };

  const handleAnular = async (cobroId) => {
    const cobro = cobros.find(c => c.id === cobroId);

    if (!cobro) {
      alert('❌ Cobro no encontrado');
      return;
    }

    const motivo = prompt('Ingrese el motivo de anulación:');
    if (!motivo) return;

    try {
      // Usar el endpoint correcto según el tipo de cobro
      if (cobro.tipo === 'EMPRESA') {
        const { anularCobroEmpresa } = await import('../services/cobrosEmpresaService');
        // Para cobros tipo EMPRESA, el id del cobro ES el cobroEmpresaId
        await anularCobroEmpresa(cobro.id, motivo, empresaSeleccionada.id);
        console.log('✅ Cobro empresa anulado:', cobro.id);
      } else {
        await anularCobro(cobroId, motivo, empresaSeleccionada.id);
        console.log('✅ Cobro obra anulado:', cobroId);
      }

      // 📡 Notificar al contexto centralizado
      eventBus.emit(FINANCIAL_EVENTS.COBRO_ELIMINADO, {
        presupuestoId: cobro.presupuestoNoClienteId,
        cobroId
      });

      if (onSuccess) {
        onSuccess({
          mensaje: '⚠️ Cobro anulado exitosamente'
        });
      }

      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else {
        cargarCobros();
      }
    } catch (err) {
      console.error('Error anulando cobro:', err);
      alert('Error al anular cobro');
    }
  };

  const handleEliminar = async (cobroId) => {
    const cobro = cobros.find(c => c.id === cobroId);

    if (!cobro) {
      alert('❌ Cobro no encontrado');
      return;
    }

    const confirmar = window.confirm('⚠️ ¿Está seguro de eliminar este cobro? Esta acción no se puede deshacer.');
    if (!confirmar) return;

    try {
      // 🔑 Usar el endpoint correcto según el tipo de cobro
      if (cobro.tipo === 'EMPRESA') {
        // Eliminar cobro empresa usando la API correcta
        const { eliminarCobroEmpresa } = await import('../services/cobrosEmpresaService');
        // Para cobros tipo EMPRESA, el id del cobro ES el cobroEmpresaId
        await eliminarCobroEmpresa(cobro.id, empresaSeleccionada.id);
      } else {
        // Eliminar cobro obra (API antigua)
        await eliminarCobro(cobroId, empresaSeleccionada.id);
      }

      // 📡 Notificar al contexto centralizado
      eventBus.emit(FINANCIAL_EVENTS.COBRO_ELIMINADO, {
        presupuestoId: cobro.presupuestoNoClienteId,
        cobroId
      });

      if (onSuccess) {
        onSuccess({
          mensaje: '🗑️ Cobro eliminado exitosamente'
        });
      }

      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else {
        cargarCobros();
      }
    } catch (err) {
      console.error('Error eliminando cobro:', err);

      // Mostrar mensaje específico del backend
      const mensaje = err?.response?.data?.message || err?.message || 'Error desconocido al eliminar el cobro';
      alert(`❌ Error al eliminar cobro:\n\n${mensaje}`);
    }
  };

  const cobrosFiltrados = cobros.filter(cobro => {
    if (filtroEstado === 'TODOS') return true;
    return cobro.estado?.toUpperCase() === filtroEstado;
  });

  // 📋 Agrupar cobros por obra para mejor UX en modo consolidado
  const agruparPorObra = (listaCobros) => {
    const grupos = {};
    listaCobros.forEach(cobro => {
      const nombreObra = cobro.nombreObra || 'Sin nombre';
      if (!grupos[nombreObra]) {
        grupos[nombreObra] = [];
      }
      grupos[nombreObra].push(cobro);
    });
    return grupos;
  };

  // 🎯 Renderizar información de ítems asignados al cobro
  const renderizarItemsAsignados = (cobro) => {
    const items = [];

    // Si es cobro de empresa, mostrar texto diferente
    if (cobro.tipo === 'EMPRESA') {
      return (
        <div>
          <span className="badge bg-info">💰 Cobro a Empresa</span>
          <div className="text-muted small mt-1">
            (Asignado a nivel obra, no por ítems)
          </div>
        </div>
      );
    }

    // Verificar si hay asignaciones (solo para cobros de obra)
    if (!cobro.asignaciones || cobro.asignaciones.length === 0) {
      return (
        <div>
          <span className="badge bg-secondary">💼 Sin asignación</span>
          <div className="text-muted small mt-1">
            (No distribuido por ítems)
          </div>
        </div>
      );
    }

    // Sumar montos de todas las asignaciones activas
    const totales = {
      profesionales: 0,
      materiales: 0,
      gastosGenerales: 0,
      trabajosExtra: 0
    };

    cobro.asignaciones
      .filter(a => a.estado === 'ACTIVA')
      .forEach(asig => {
        if (asig.montoProfesionales > 0) {
          totales.profesionales += parseFloat(asig.montoProfesionales);
        }
        if (asig.montoMateriales > 0) {
          totales.materiales += parseFloat(asig.montoMateriales);
        }
        if (asig.montoGastosGenerales > 0) {
          totales.gastosGenerales += parseFloat(asig.montoGastosGenerales);
        }
        if (asig.montoTrabajosExtra > 0) {
          totales.trabajosExtra += parseFloat(asig.montoTrabajosExtra);
        }
      });

    // Renderizar los totales
    if (totales.profesionales > 0) {
      items.push(
        <div key="prof" className="mb-1">
          <span className="badge bg-primary me-1">👷 Profesionales</span>
          <span className="text-primary fw-bold">{formatearMoneda(totales.profesionales)}</span>
        </div>
      );
    }
    if (totales.materiales > 0) {
      items.push(
        <div key="mat" className="mb-1">
          <span className="badge bg-warning text-dark me-1">🔧 Materiales</span>
          <span className="text-warning fw-bold">{formatearMoneda(totales.materiales)}</span>
        </div>
      );
    }
    if (totales.gastosGenerales > 0) {
      items.push(
        <div key="gg" className="mb-1">
          <span className="badge bg-success me-1">📋 Gastos Generales</span>
          <span className="text-success fw-bold">{formatearMoneda(totales.gastosGenerales)}</span>
        </div>
      );
    }
    if (totales.trabajosExtra > 0) {
      items.push(
        <div key="te" className="mb-1">
          <span className="badge bg-info text-white me-1">� Trabajos Extra</span>
          <span className="text-info fw-bold">{formatearMoneda(totales.trabajosExtra)}</span>
        </div>
      );
    }

    // Si no hay distribución por ítems, mostrar "General"
    if (items.length === 0) {
      return (
        <div>
          <span className="badge bg-info text-dark">💼 General</span>
          <div className="text-muted small mt-1">
            ({cobro.asignaciones.length} asignación(es) sin detalles)
          </div>
        </div>
      );
    }

    return <div className="small">{items}</div>;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog modal-xl" style={{marginTop: '40px', maxWidth: '1200px'}}>
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">💰 Cobros de Obra</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* Mostrar alerta en modo consolidado */}
            {modoConsolidado && (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                {haySeleccionParcial ? (
                  <><strong>Obras Seleccionadas:</strong> Mostrando cobros de {obrasSeleccionadas.size} obra(s) seleccionada(s)</>
                ) : (
                  <><strong>Modo Consolidado:</strong> Mostrando cobros de todas las obras</>
                )}
              </div>
            )}

            {/* Selector de dirección de obra - solo si NO está en modo consolidado */}
            {!modoConsolidado && (
              <DireccionObraSelector
                value={direccionSeleccionada}
                onChange={setDireccionSeleccionada}
                required={false}
                label="Seleccionar Dirección de la Obra"
                readOnly={!!obraDireccion}
              />
            )}

            {/* Información de la obra */}
            {(direccionSeleccionada || modoConsolidado) && (
              <>

                {/* Resumen financiero */}
                <div className="row mb-4">
                  <div className="col-md-4">
                    <div className="card border-success">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Cobrado</h6>
                        <h4 className="text-success mb-0">{formatearMoneda(totalCobrado)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card border-warning">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Pendiente</h6>
                        <h4 className="text-warning mb-0">{formatearMoneda(totalPendiente)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card border-primary">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Presupuesto</h6>
                        <h4 className="text-primary mb-0">{formatearMoneda(totalPresupuesto)}</h4>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Cobros Empresa: siempre visible justo debajo del resumen ── */}
                {modoConsolidado && (() => {
                  const entEmpresa = entidades.find(e => e.tipo === 'EMPRESA');
                  if (!entEmpresa) return null;
                  const cobrosEmp = entEmpresa.cobros.filter(c =>
                    filtroEstado === 'TODOS' || c.estado?.toUpperCase() === filtroEstado
                  );
                  return (
                    <div className="card mb-3 border-dark">
                      <div className="card-header py-2 d-flex justify-content-between align-items-center bg-dark text-white">
                        <div>
                          <span className="badge bg-secondary me-2">💼 Cobros Empresa</span>
                          <strong>{entEmpresa.nombre}</strong>
                        </div>
                        <div className="d-flex gap-3 text-end">
                          <div>
                            <small className="d-block" style={{fontSize:'0.7rem', opacity:0.75}}>Cobrado</small>
                            <span className="fw-bold text-success">{formatearMoneda(entEmpresa.totalCobrado)}</span>
                          </div>
                        </div>
                      </div>
                      {cobrosEmp.length === 0 ? (
                        <div className="card-body py-2 text-muted small">
                          <i className="bi bi-dash-circle me-1"></i>Sin cobros a empresa
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm table-hover mb-0">
                            <thead className="table-light">
                              <tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Vencimiento</th><th>Método</th><th>Estado</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                              {cobrosEmp.map(cobro => {
                                const estadoInfo = obtenerEstadoCobro(cobro);
                                const vencido = estaVencido(cobro);
                                return (
                                  <tr key={cobro.id} className={vencido ? 'table-danger' : ''}>
                                    <td>{formatearFecha(cobro.fechaEmision)}</td>
                                    <td>
                                      {cobro.descripcion}
                                      {cobro.numeroComprobante && <div className="text-muted small">N° {cobro.numeroComprobante}</div>}
                                    </td>
                                    <td className="fw-bold">{formatearMoneda(cobro.monto)}</td>
                                    <td>{cobro.fechaVencimiento ? <>{formatearFecha(cobro.fechaVencimiento)}{vencido && <div className="text-danger small">¡Vencido!</div>}</> : <span className="text-muted">Sin vencimiento</span>}</td>
                                    <td>{cobro.metodoPago || '-'}</td>
                                    <td><span className={`badge bg-${estadoInfo.color}`}>{estadoInfo.icon} {estadoInfo.label}</span></td>
                                    <td>
                                      <div className="btn-group btn-group-sm" role="group">
                                        {cobro.estado === 'PENDIENTE' && <button className="btn btn-success" onClick={() => handleMarcarCobrado(cobro.id)} title="Marcar como cobrado">✓</button>}
                                        {['PENDIENTE','COBRADO'].includes(cobro.estado?.toUpperCase()) && <button className="btn btn-warning" onClick={() => handleAnular(cobro.id)} title="Anular cobro">✗</button>}
                                        <button className="btn btn-danger" onClick={() => handleEliminar(cobro.id)} title="Eliminar cobro">🗑️</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Filtros */}
                <div className="mb-3">
                  <label className="form-label fw-bold">Filtrar por Estado:</label>
                  <div className="btn-group" role="group">
                    <button
                      className={`btn ${filtroEstado === 'TODOS' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFiltroEstado('TODOS')}
                    >
                      Todos ({cobros.length})
                    </button>
                    <button
                      className={`btn ${filtroEstado === 'PENDIENTE' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => setFiltroEstado('PENDIENTE')}
                    >
                      Pendientes ({cobros.filter(c => c.estado === 'PENDIENTE').length})
                    </button>
                    <button
                      className={`btn ${filtroEstado === 'COBRADO' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setFiltroEstado('COBRADO')}
                    >
                      Cobrados ({cobros.filter(c => c.estado === 'COBRADO').length})
                    </button>
                    <button
                      className={`btn ${filtroEstado === 'VENCIDO' ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => setFiltroEstado('VENCIDO')}
                    >
                      Vencidos ({cobros.filter(c => c.estado === 'VENCIDO' || estaVencido(c)).length})
                    </button>
                  </div>
                </div>

                {/* Tabla de cobros */}
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  </div>
                ) : modoConsolidado ? (
                  /* ── MODO CONSOLIDADO: agrupado por Obra Principal → TE → TA / OI ── */
                  entidades.filter(e => e.tipo !== 'EMPRESA').length === 0 ? (
                    <div className="alert alert-info">
                      No hay entidades registradas{haySeleccionParcial ? ' para las obras seleccionadas' : ''}.
                    </div>
                  ) : (
                    <div style={{maxHeight: '600px', overflowY: 'auto'}}>
                      {(() => {
                        const tipoBadge = {
                          OBRA_PRINCIPAL:     { label: 'Obra Principal',            color: 'primary'           },
                          OBRA_INDEPENDIENTE: { label: 'Trabajo Diario',            color: 'info'              },
                          TRABAJO_EXTRA:      { label: 'Adicional Obra',            color: 'warning text-dark' },
                          TRABAJO_ADICIONAL:  { label: 'Tarea Leve / Mantenimiento', color: 'secondary'         },
                        };

                        const renderEntidadCard = (entidad, idx, indentada = false, marginLeft = '1.5rem') => {
                          const cobrosEntidad = entidad.cobros.filter(c =>
                            filtroEstado === 'TODOS' || c.estado?.toUpperCase() === filtroEstado
                          );
                          const badge = tipoBadge[entidad.tipo] || { label: entidad.tipo, color: 'secondary' };
                          return (
                            <div
                              key={`ent_${entidad.id}_${idx}`}
                              className="card mb-2"
                              style={indentada ? { marginLeft: marginLeft, borderLeft: '3px solid #dee2e6' } : {}}
                            >
                              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                                <div>
                                  <span className={`badge bg-${badge.color} me-2`}>{badge.label}</span>
                                  <strong>{entidad.nombre}</strong>
                                  {entidad.obraPadreNombre && (
                                    <small className="text-muted ms-2">(de: {entidad.obraPadreNombre})</small>
                                  )}
                                </div>
                                <div className="d-flex gap-3 text-end">
                                  {entidad.presupuesto > 0 && (
                                    <div>
                                      <small className="text-muted d-block" style={{fontSize:'0.7rem'}}>Presupuesto</small>
                                      <span className="fw-bold text-primary">{formatearMoneda(entidad.presupuesto)}</span>
                                    </div>
                                  )}
                                  <div>
                                    <small className="text-muted d-block" style={{fontSize:'0.7rem'}}>Cobrado</small>
                                    <span className={`fw-bold ${entidad.totalCobrado > 0 ? 'text-success' : 'text-muted'}`}>
                                      {formatearMoneda(entidad.totalCobrado)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {cobrosEntidad.length === 0 ? (
                                <div className="card-body py-2 text-muted small">
                                  <i className="bi bi-dash-circle me-1"></i>
                                  {filtroEstado !== 'TODOS'
                                    ? `Sin cobros en estado "${filtroEstado.toLowerCase()}"`
                                    : 'Sin cobros registrados — $0 cobrado'}
                                </div>
                              ) : (
                                <div className="table-responsive">
                                  <table className="table table-sm table-hover mb-0">
                                    <thead className="table-light">
                                      <tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Vencimiento</th><th>Método</th><th>Estado</th><th>Acciones</th></tr>
                                    </thead>
                                    <tbody>
                                      {cobrosEntidad.map(cobro => {
                                        const estadoInfo = obtenerEstadoCobro(cobro);
                                        const vencido = estaVencido(cobro);
                                        return (
                                          <tr key={cobro.id} className={vencido ? 'table-danger' : ''}>
                                            <td>{formatearFecha(cobro.fechaEmision)}</td>
                                            <td>
                                              {cobro.descripcion}
                                              {cobro.numeroComprobante && <div className="text-muted small">N° {cobro.numeroComprobante}</div>}
                                            </td>
                                            <td className="fw-bold">{formatearMoneda(cobro.monto)}</td>
                                            <td>{cobro.fechaVencimiento ? <>{formatearFecha(cobro.fechaVencimiento)}{vencido && <div className="text-danger small">¡Vencido!</div>}</> : <span className="text-muted">Sin vencimiento</span>}</td>
                                            <td>{cobro.metodoPago || '-'}</td>
                                            <td><span className={`badge bg-${estadoInfo.color}`}>{estadoInfo.icon} {estadoInfo.label}</span></td>
                                            <td>
                                              <div className="btn-group btn-group-sm" role="group">
                                                {cobro.estado === 'PENDIENTE' && <button className="btn btn-success" onClick={() => handleMarcarCobrado(cobro.id)} title="Marcar como cobrado">✓</button>}
                                                {['PENDIENTE','COBRADO'].includes(cobro.estado?.toUpperCase()) && <button className="btn btn-warning" onClick={() => handleAnular(cobro.id)} title="Anular cobro">✗</button>}
                                                <button className="btn btn-danger" onClick={() => handleEliminar(cobro.id)} title="Eliminar cobro">🗑️</button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        };

                        // 1. Obras Principales + sus Trabajos Extra + sus Trabajos Adicionales anidados
                        const obrasPrincipales = entidades.filter(e => e.tipo === 'OBRA_PRINCIPAL');
                        const trabajosExtra = entidades.filter(e => e.tipo === 'TRABAJO_EXTRA');
                        // 2. Trabajos Diarios (Obras Independientes)
                        const trabajosDiarios = entidades.filter(e => e.tipo === 'OBRA_INDEPENDIENTE');
                        // 3. Trabajos Adicionales huérfanos (sin obra padre)
                        const trabajosAdicionalesHuerfanos = entidades.filter(e => e.tipo === 'TRABAJO_ADICIONAL');

                        return (
                          <>
                            {/* Obras Principales con Adicionales Obra y Tareas Leves anidados */}
                            {obrasPrincipales.length > 0 && (
                              <>
                                <div className="d-flex align-items-center mb-2 mt-1">
                                  <span className="badge bg-primary me-2">Obras Principales</span>
                                  <hr className="flex-grow-1 m-0" />
                                </div>
                                {obrasPrincipales.map((obra, idx) => (
                                  <div key={`op_group_${obra.id}`}>
                                    {renderEntidadCard(obra, idx, false)}
                                    {/* Adicionales Obra (Trabajos Extra) con sus Tareas Leves */}
                                    {trabajosExtra
                                      .filter(te => te.obraPadreNombre === obra.nombre)
                                      .map((te, teIdx) => (
                                        <React.Fragment key={`te_frag_${te.id}`}>
                                          {renderEntidadCard(te, teIdx, true)}
                                          {/* Tareas Leves del Trabajo Extra */}
                                          {te.trabajosAdicionales && te.trabajosAdicionales.length > 0 && (
                                            te.trabajosAdicionales.map((ta, taIdx) =>
                                              renderEntidadCard(ta, taIdx, true, '3rem')
                                            )
                                          )}
                                        </React.Fragment>
                                      ))
                                    }
                                    {/* Tareas Leves (Trabajos Adicionales) de la Obra Principal */}
                                    {obra.trabajosAdicionales && obra.trabajosAdicionales.length > 0 && (
                                      <>
                                        {obra.trabajosAdicionales.map((ta, taIdx) =>
                                          renderEntidadCard(ta, taIdx, true, '1.5rem')
                                        )}
                                      </>
                                    )}
                                  </div>
                                ))}
                                {/* Trabajos Extra huérfanos (sin obra padre en la lista) */}
                                {trabajosExtra
                                  .filter(te => !obrasPrincipales.some(op => op.nombre === te.obraPadreNombre))
                                  .map((te, idx) => renderEntidadCard(te, idx, false))
                                }
                              </>
                            )}

                            {/* Trabajos Diarios (Obras Independientes) */}
                            {trabajosDiarios.length > 0 && (
                              <>
                                <div className="d-flex align-items-center mb-2 mt-3">
                                  <span className="badge bg-info me-2">Trabajos Diarios</span>
                                  <hr className="flex-grow-1 m-0" />
                                </div>
                                {trabajosDiarios.map((td, idx) => renderEntidadCard(td, idx, false))}
                              </>
                            )}

                            {/* Tareas Leves huérfanas (sin obra padre) */}
                            {trabajosAdicionalesHuerfanos.length > 0 && (
                              <>
                                <div className="d-flex align-items-center mb-2 mt-3">
                                  <span className="badge bg-secondary me-2">Tareas Leves</span>
                                  <hr className="flex-grow-1 m-0" />
                                </div>
                                {trabajosAdicionalesHuerfanos.map((ta, idx) => renderEntidadCard(ta, idx, false))}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )
                ) : cobrosFiltrados.length === 0 ? (
                  /* ── MODO INDIVIDUAL sin cobros ── */
                  <div className="alert alert-info">
                    No hay cobros registrados{filtroEstado !== 'TODOS' ? ` en estado ${filtroEstado.toLowerCase()}` : ''}.
                  </div>
                ) : (
                  /* ── MODO INDIVIDUAL con cobros ── */
                  <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <table className="table table-hover table-bordered">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Fecha Emisión</th>
                          <th>Descripción</th>
                          <th>Monto</th>
                          <th>Vencimiento</th>
                          <th>Método Pago</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          // Modo individual: Sin agrupación
                          cobrosFiltrados.map(cobro => {
                            const estadoInfo = obtenerEstadoCobro(cobro);
                            const vencido = estaVencido(cobro);

                            return (
                              <tr key={cobro.id} className={vencido ? 'table-danger' : ''}>
                                <td>{formatearFecha(cobro.fechaEmision)}</td>
                                <td>
                                  {cobro.descripcion}
                                  {cobro.numeroComprobante && (
                                    <div className="text-muted small">
                                      N° {cobro.numeroComprobante}
                                    </div>
                                  )}
                                </td>

                                <td className="fw-bold">{formatearMoneda(cobro.monto)}</td>
                                <td>
                                  {cobro.fechaVencimiento ? (
                                    <>
                                      {formatearFecha(cobro.fechaVencimiento)}
                                      {vencido && <div className="text-danger small">¡Vencido!</div>}
                                    </>
                                  ) : (
                                    <span className="text-muted">Sin vencimiento</span>
                                  )}
                                </td>
                                <td>{cobro.metodoPago || '-'}</td>
                                <td>
                                  <span className={`badge bg-${estadoInfo.color}`}>
                                    {estadoInfo.icon} {estadoInfo.label}
                                  </span>
                                </td>
                                <td>
                                  <div className="btn-group btn-group-sm" role="group">
                                    {cobro.estado === 'PENDIENTE' && (
                                      <button
                                        className="btn btn-success"
                                        onClick={() => handleMarcarCobrado(cobro.id)}
                                        title="Marcar como cobrado"
                                      >
                                        ✓
                                      </button>
                                    )}
                                    {(cobro.estado?.toUpperCase() === 'PENDIENTE' || cobro.estado?.toUpperCase() === 'COBRADO') && (
                                      <button
                                        className="btn btn-warning"
                                        onClick={() => handleAnular(cobro.id)}
                                        title="Anular cobro"
                                      >
                                        ✗
                                      </button>
                                    )}
                                    <button
                                      className="btn btn-danger"
                                      onClick={() => handleEliminar(cobro.id)}
                                      title="Eliminar cobro"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarCobrosObraModal;
