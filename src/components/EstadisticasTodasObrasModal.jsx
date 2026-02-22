import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEstadisticasConsolidadas } from '../hooks/useEstadisticasConsolidadas';
import DetalleConsolidadoPorObraModal from './DetalleConsolidadoPorObraModal';
import DetalleDistribucionCobrosModal from './DetalleDistribucionCobrosModal';
import { calcularTotalConDescuentosDesdeItems } from '../utils/presupuestoDescuentosUtils';

const EstadisticasTodasObrasModal = ({
  empresaId,
  empresaSeleccionada,
  onClose,
  showNotification,
  obrasDisponibles = [], // ✅ Obras cargadas (incluye obras independientes)
  obrasSeleccionadas = new Set(), // ✅ IDs de obras seleccionadas
  trabajosExtraSeleccionados = new Set(), // ✅ IDs de trabajos extra seleccionados
  trabajosAdicionalesDisponibles = [] // ✅ Trabajos adicionales disponibles
}) => {
  const [showDesglose, setShowDesglose] = useState(false);
  const [desgloseTipo, setDesgloseTipo] = useState('');
  const [desgloseTitulo, setDesgloseTitulo] = useState('');
  const [showDistribucionCobros, setShowDistribucionCobros] = useState(false);

  // 🆕 Estado para datos cargados internamente
  const [taInternos, setTaInternos] = useState([]);
  // Presupuestos cargados directamente (igual que SistemaFinancieroPage)
  const [pptoNormalesInternos, setPptoNormalesInternos] = useState([]);
  const [pptoTeInternos, setPptoTeInternos] = useState([]);
  const [cobradoTAOI, setCobradoTAOI] = useState(0);

  // 🔍 Log de datos recibidos desde props
  useEffect(() => {
    console.log('🚀 [EstadisticasModal] Props recibidas:', {
      totalObras: obrasDisponibles.length,
      obrasIndependientes: obrasDisponibles.filter(o => o.esObraIndependiente).length,
      obrasPrincipales: obrasDisponibles.filter(o => !o.esObraIndependiente).length,
      detalleOIs: obrasDisponibles.filter(o => o.esObraIndependiente).map(o => ({
        id: o.id,
        nombre: o.nombreObra,
        direccion: o.direccion,
        presupuestoEstimado: o.presupuestoEstimado
      }))
    });
  }, [obrasDisponibles]);

  const {
    estadisticas,
    loading,
    error
  } = useEstadisticasConsolidadas(empresaId, null, true);

  // 🆕 Cargar TA y EF-stats cuando el modal se monta
  useEffect(() => {
    if (!empresaId) return;
    let activo = true;

    const cargar = async () => {
      try {
        const [{ listarTrabajosAdicionales }, efService, { default: api }] = await Promise.all([
          import('../services/trabajosAdicionalesService'),
          import('../services/entidadesFinancierasService'),
          import('../services/api')
        ]);

        // Trabajos adicionales
        const taProp = Array.isArray(trabajosAdicionalesDisponibles) && trabajosAdicionalesDisponibles.length > 0
          ? trabajosAdicionalesDisponibles
          : await listarTrabajosAdicionales(empresaId).catch(() => []);
        if (activo) setTaInternos(taProp);

        // ─── Cargar presupuestosNoCliente igual que SistemaFinancieroPage ──────────
        // Esto incluye TEs (esPresupuestoTrabajoExtra=true) y obras normales.
        try {
          const pptosResp = await api.presupuestosNoCliente.getAll(empresaId);
          const extract = (r) => Array.isArray(r) ? r : (r?.datos || r?.content || r?.data || []);
          const todos = extract(pptosResp);

          // Solo APROBADO y EN_EJECUCION
          const activos = todos.filter(p =>
            (p.estado === 'APROBADO' || p.estado === 'EN_EJECUCION') && p.estado !== 'CANCELADO'
          );

          // Deduplicar por nombre+nro presupuesto (igual que el hook), quedarse con ID más alto
          const pptoMap = new Map();
          activos.forEach(p => {
            const key = `${p.nombreObra || ''}-${p.numeroPresupuesto || ''}`;
            if (!pptoMap.has(key) || p.id > pptoMap.get(key).id) pptoMap.set(key, p);
          });
          const unicos = Array.from(pptoMap.values());

          const isTE = (p) => p.esPresupuestoTrabajoExtra === true ||
                              p.esPresupuestoTrabajoExtra === 'V' ||
                              p.es_presupuesto_trabajo_extra === true;

          if (activo) {
            setPptoNormalesInternos(unicos.filter(p => !isTE(p)));
            setPptoTeInternos(unicos.filter(p => isTE(p)));
            console.log('[EstadisticasModal] Presupuestos cargados:',
              'normales:', unicos.filter(p => !isTE(p)).length,
              'TEs:', unicos.filter(p => isTE(p)).length);
          }
        } catch (ePpto) {
          console.warn('[EstadisticasModal] Error cargando presupuestos:', ePpto.message);
        }

        // EF stats para TA y OI (circuito nuevo)
        const todasEFs = await efService.listarEntidadesFinancieras(empresaId, true).catch(() => []);
        const taOiEFs = (Array.isArray(todasEFs) ? todasEFs : []).filter(ef =>
          ef.tipoEntidad === 'TRABAJO_ADICIONAL' || ef.tipoEntidad === 'OBRA_INDEPENDIENTE'
        );
        const ids = taOiEFs.map(ef => ef.id).filter(Boolean);
        if (ids.length > 0) {
          const stats = await efService.obtenerEstadisticasMultiples(empresaId, ids).catch(() => []);
          const total = (Array.isArray(stats) ? stats : []).reduce((s, e) => s + parseFloat(e.totalCobrado || 0), 0);
          if (activo) setCobradoTAOI(total);
        }
      } catch (e) {
        console.warn('[EstadisticasModal] Error cargando TA/EF:', e.message);
      }
    };

    cargar();
    return () => { activo = false; };
  }, [empresaId]);

  // ✅ Calcular estadísticas personalizadas
  const statsPersonalizadas = React.useMemo(() => {
    if (!estadisticas) return estadisticas;

    // ─── Modo "sin selección" (llamado desde ObrasPage con Sets vacíos) ──────────
    // El hook useEstadisticasConsolidadas ya calculó todo desde el backend:
    // totalPresupuesto incluye OP + OI + TE + TA reales.
    // No reemplazar esos valores con datos incompletos del store Redux.
    if (obrasSeleccionadas.size === 0 && trabajosExtraSeleccionados.size === 0) {
      // ─── Misma lógica que SistemaFinancieroPage ───────────────────────────────

      // 1. OP — desde presupuestosNoCliente (normales), aplicando descuentos como useEstadisticasConsolidadas
      const calcularTotalConDescuentos = (p) => {
        // ✅ Prioridad 1: Si ya tiene totalConDescuentos calculado, usarlo
        if (p.totalConDescuentos != null && p.totalConDescuentos > 0) {
          return parseFloat(p.totalConDescuentos);
        }

        // ✅ Prioridad 2: Si tiene items y configuración de descuentos, calcular con descuentos
        if (p.itemsCalculadora && Array.isArray(p.itemsCalculadora) && p.itemsCalculadora.length > 0) {
          try {
            const resultado = calcularTotalConDescuentosDesdeItems(p.itemsCalculadora, p);
            if (resultado.totalFinal > 0) {
              return resultado.totalFinal;
            }
          } catch (error) {
            console.warn('⚠️ Error calculando con descuentos:', error);
          }
        }

        // Fallback: usar valores sin descuentos
        return parseFloat(
          p.totalFinal ||
          p.valorTotalIva ||
          p.totalPresupuestoConHonorarios ||
          p.totalPresupuesto ||
          p.montoTotal ||
          p.valorTotal || 0
        );
      };
      const totalOP = pptoNormalesInternos.reduce((s, p) => s + calcularTotalConDescuentos(p), 0);
      const cantidadOP = pptoNormalesInternos.length;

      // 2. TE — desde presupuestosNoCliente con esPresupuestoTrabajoExtra=true
      const totalTE = pptoTeInternos.reduce((s, p) => s + calcularTotalConDescuentos(p), 0);
      const cantidadTE = pptoTeInternos.length;

      // 3. OI — desde obrasDisponibles (no tienen presupuesto, nunca en el hook)
      const oiMap = new Map();
      obrasDisponibles.forEach(obra => {
        if (!obra.esObraIndependiente) return;
        const clave = `${obra.nombreObra || ''}_${obra.direccion || ''}`.trim();
        const monto = parseFloat(obra.totalPresupuesto || obra.presupuestoEstimado || 0);
        if (!oiMap.has(clave) || monto > (oiMap.get(clave) || 0)) oiMap.set(clave, monto);
      });
      const totalOI = Array.from(oiMap.values()).reduce((s, v) => s + v, 0);
      const cantidadOI = oiMap.size;

      // 4. TA — desde taInternos
      const taIds = new Set();
      const totalTA = taInternos.reduce((s, ta) => {
        if (!taIds.has(ta.id)) { taIds.add(ta.id); return s + parseFloat(ta.importe || ta.montoTotal || ta.monto || 0); }
        return s;
      }, 0);
      const cantidadTA = taIds.size;

      // Esperar a que carguen los presupuestos antes de mostrar el total
      const cargando = pptoNormalesInternos.length === 0 && pptoTeInternos.length === 0 && taInternos.length === 0;
      const totalPresupuestoFinal = cargando
        ? (estadisticas.totalPresupuesto || 0)   // Mientras carga: usar el hook
        : totalOP + totalTE + totalOI + totalTA;  // Cargado: calcular igual que SFP

      console.log('✅ [EstadisticasModal - Modo ObrasPage] Totales (igual que SFP):', {
        totalOP, cantidadOP,
        totalTE, cantidadTE,
        totalOI, cantidadOI,
        totalTA, cantidadTA,
        totalPresupuestoFinal
      });

      return {
        ...estadisticas,
        cantidadObras: cantidadOP + cantidadTE + cantidadOI,  // igual que hook: incluye TEs
        cantidadTrabajosExtra: cantidadTE,
        cantidadTrabajosAdicionales: cantidadTA,
        totalPresupuesto: totalPresupuestoFinal,
        _totalTE: totalTE,
        _totalTA: totalTA
      };
    }

    // ─── Modo "con selecciones activas" (llamado desde SistemaFinancieroPage) ───
    // Aquí obrasDisponibles sí tiene presupuestoCompleto completo.
    const taDisponibles = taInternos.length > 0 ? taInternos : trabajosAdicionalesDisponibles;

    let cantidadObrasConPresupuesto = 0;
    let cantidadObrasIndependientes = 0;
    const presupuestosUnicos = new Map();
    const obrasIndepMap = new Map();
    let totalTrabajosExtra = 0;
    let cantidadTrabajosExtra = 0; // 🆕 Contador de TEs

    obrasDisponibles
      .filter(o => obrasSeleccionadas.has(o.id))
      .forEach(obra => {
        if (obra.esObraIndependiente) {
          // 🆕 Deduplicar OIs por nombre_direccion (no por ID que puede variar)
          const claveUnica = `${obra.nombreObra || ''}_${obra.direccion || ''}`.trim();
          const existente = obrasIndepMap.get(claveUnica);
          const montoActual = parseFloat(obra.totalPresupuesto || obra.presupuestoEstimado || 0);

          if (!existente || montoActual > existente.monto) {
            obrasIndepMap.set(claveUnica, { monto: montoActual, id: obra.id });
            if (!existente) cantidadObrasIndependientes++;
          }
          return;
        }
        const idPpto = obra.presupuestoCompleto?.id ?? obra.presupuestoNoClienteId ?? obra.presupuestoNoCliente?.id;
        if (idPpto && !presupuestosUnicos.has(idPpto)) {
          const monto = parseFloat(
            obra.presupuestoCompleto?.totalPresupuestoConHonorarios ??
            obra.presupuestoCompleto?.totalFinal ??
            obra.presupuestoCompleto?.montoTotal ??
            obra.totalPresupuestoConHonorarios ??
            obra.totalFinal ??
            obra.totalPresupuesto ?? 0
          );
          presupuestosUnicos.set(idPpto, monto);
          cantidadObrasConPresupuesto++;
        }
        if (obra.trabajosExtra && obra.trabajosExtra.length > 0) {
          const sel = trabajosExtraSeleccionados.size > 0
            ? obra.trabajosExtra.filter(te => trabajosExtraSeleccionados.has(te.id))
            : obra.trabajosExtra;
          totalTrabajosExtra += sel.reduce((s, te) => s + parseFloat(te.totalCalculado || te.totalFinal || 0), 0);
          cantidadTrabajosExtra += sel.length; // 🆕 Contar TEs
        }
      });

    // 🆕 Deduplicar TAs por ID antes de sumar
    const taIdsContados = new Set();
    const totalTA = taDisponibles.reduce((sum, ta) => {
      if (!taIdsContados.has(ta.id)) {
        taIdsContados.add(ta.id);
        return sum + parseFloat(ta.importe || ta.montoTotal || ta.monto || 0);
      }
      return sum;
    }, 0);

    const totalIndependientes = Array.from(obrasIndepMap.values()).reduce((s, v) => s + v.monto, 0);
    const totalPresupuestos = Array.from(presupuestosUnicos.values()).reduce((s, v) => s + v, 0);
    const totalPresupuestoCalculado = totalPresupuestos + totalIndependientes + totalTrabajosExtra + totalTA;

    console.log('✅ [EstadisticasModal] Totales calculados:', {
      totalPresupuestos,
      totalIndependientes,
      totalTrabajosExtra,
      totalTA,
      taUnicosContados: taIdsContados.size,
      oiUnicosContados: obrasIndepMap.size,
      cantidadTrabajosExtra,
      totalPresupuestoCalculado
    });

    return {
      ...estadisticas,
      totalPresupuesto: totalPresupuestoCalculado > 0 ? totalPresupuestoCalculado : (estadisticas.totalPresupuesto || 0),
      cantidadObras: cantidadObrasConPresupuesto + cantidadObrasIndependientes + taDisponibles.length,
      cantidadObrasConPresupuesto,
      cantidadObrasIndependientes,
      _totalTE: totalTrabajosExtra,
      _totalTA: totalTA,
      cantidadTrabajosExtra, // 🆕 Cantidad de TEs
      cantidadTrabajosAdicionales: taIdsContados.size // 🆕 Cantidad de TAs únicos
    };
  }, [estadisticas, obrasDisponibles, obrasSeleccionadas, trabajosExtraSeleccionados, taInternos, pptoNormalesInternos, pptoTeInternos, trabajosAdicionalesDisponibles, cobradoTAOI]);

  const abrirDesglose = (tipo, titulo) => {
    // 'cobros' y 'saldoPorCobrar' cargan datos internamente en el modal — no requieren desglosePorObra
    const tiposSinDesglose = ['cobros', 'saldoPorCobrar'];
    if (!tiposSinDesglose.includes(tipo) && (!statsPersonalizadas?.desglosePorObra || statsPersonalizadas.desglosePorObra.length === 0)) {
      showNotification?.('warning', 'No hay datos de desglose disponibles');
      return;
    }
    setDesgloseTipo(tipo);
    setDesgloseTitulo(titulo);
    setShowDesglose(true);
  };

  const formatearMoneda = (valor) => {
    if (!valor && valor !== 0) return '$0,00';
    return `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  // Datos para gráficos (usar estadísticas personalizadas)
  const datosDistribucion = [
    { name: 'Cobrado', value: statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0, color: '#28a745' },
    { name: 'Por Cobrar', value: statsPersonalizadas.totalPresupuesto - (statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0), color: '#ffc107' },
    { name: 'Pagado', value: statsPersonalizadas.totalPagado, color: '#dc3545' }
  ].filter(d => d.value > 0);

  const datosBarras = [
    { categoria: 'Presupuesto', monto: statsPersonalizadas.totalPresupuesto },
    { categoria: 'Cobrado', monto: statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0 },
    { categoria: 'Pagado', monto: statsPersonalizadas.totalPagado },
    { categoria: 'Disponible', monto: statsPersonalizadas.saldoDisponible }
  ];

  const topObras = statsPersonalizadas.desglosePorObra
    ?.slice(0, 10)
    ?.sort((a, b) => b.totalPresupuesto - a.totalPresupuesto) || [];

  return (
    <>
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="fas fa-chart-bar me-2"></i>
              Estadísticas Consolidadas - {(estadisticas?.cantidadObras || statsPersonalizadas.cantidadObras)} Obra(s)
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onClose}>
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {loading && (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Cargando estadísticas...</span>
                </div>
                <p className="text-muted mt-2">Consolidando datos de todas las obras...</p>
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Primera fila: 4 tarjetas principales */}
                <div className="row text-center mb-3">
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('presupuestos', '📋 Desglose de Presupuestos por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-cash-stack fs-1 text-info"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Presupuestado</h6>
                      <h4 className="text-info mb-0">{formatearMoneda(statsPersonalizadas.totalPresupuesto)}</h4>
                      <small className="text-muted">
                        De {statsPersonalizadas.cantidadObras || 0} obra(s)
                        {(statsPersonalizadas.cantidadTrabajosExtra || 0) > 0 ? ` + ${statsPersonalizadas.cantidadTrabajosExtra} TE` : ''}
                        {(statsPersonalizadas.cantidadTrabajosAdicionales || 0) > 0 ? ` + ${statsPersonalizadas.cantidadTrabajosAdicionales} TA` : ''}
                      </small>
                      <div className="mt-1">
                        <small className="text-info"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('cobros', '💵 Desglose de Cobros por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-arrow-down-circle fs-1 text-success"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Cobrado</h6>
                      <h4 className="text-success mb-0">{formatearMoneda(statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0)}</h4>
                      <small className="text-muted">{((statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0) / (statsPersonalizadas.totalPresupuesto || 1) * 100).toFixed(1)}% del presupuesto total</small>
                      <div className="mt-1">
                        <small className="text-success"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('pagos', '💸 Desglose de Pagos por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-arrow-up-circle fs-1 text-danger"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Pagado</h6>
                      <h4 className="text-danger mb-0">{formatearMoneda(statsPersonalizadas.totalPagado)}</h4>
                      <small className="text-muted">{statsPersonalizadas.porcentajePagado.toFixed(1)}% del presupuesto total</small>
                      <div className="mt-1">
                        <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-wallet2 fs-1 text-warning"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Retirado</h6>
                      <h4 className="text-warning mb-0">{formatearMoneda(statsPersonalizadas.totalRetirado || 0)}</h4>
                      <small className="text-muted">Retiros personales</small>
                      <div className="mt-1">
                        <small className="text-warning"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segunda fila: 4 tarjetas de balance */}
                <div className="row text-center">
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('saldoPorCobrar', '⏳ Desglose de Saldo por Cobrar por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-hourglass-split fs-1 text-warning"></i>
                      <h6 className="text-muted mt-2 mb-1">Saldo por Cobrar</h6>
                      <h4 className="text-warning mb-0">
                        {formatearMoneda(statsPersonalizadas.totalPresupuesto - (statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0))}
                      </h4>
                      <small className="text-muted">
                        Falta cobrar {(
                          statsPersonalizadas.totalPresupuesto > 0
                            ? (100 * (statsPersonalizadas.totalPresupuesto - (statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0)) / statsPersonalizadas.totalPresupuesto)
                            : 0
                        ).toFixed(1)}% del presupuesto
                      </small>
                      <div className="mt-1">
                        <small className="text-warning"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => setShowDistribucionCobros(true)}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-bank fs-1 text-info"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Distribuido Obras</h6>
                      <h4 className="text-primary mb-0">
                        {formatearMoneda((statsPersonalizadas.totalAsignado || 0) + cobradoTAOI)}
                      </h4>
                      <small className="text-muted">
                        Obras principales, TE, OI y TA
                      </small>
                      <div className="mt-1">
                        <small className="text-info"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('saldoDisponible', '💰 Desglose de Saldo Disponible')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-piggy-bank fs-1 text-primary"></i>
                      <h6 className="text-muted mt-2 mb-1">Total disponible de lo ya cobrado</h6>
                      <h4 className="mb-0 text-primary">
                        {(() => {
                          if (loading) {
                            return <span className="spinner-border spinner-border-sm" role="status"></span>;
                          }
                          // Calcular: Total Cobrado - Total Asignado a obras (incluyendo TA y OI)
                          const totalCobrado = statsPersonalizadas.totalCobradoEmpresa || statsPersonalizadas.totalCobrado || 0;
                          const totalAsignado = (statsPersonalizadas.totalAsignado || 0) + cobradoTAOI;
                          const saldoDisponible = totalCobrado - totalAsignado;
                          return formatearMoneda(saldoDisponible);
                        })()}
                      </h4>
                      <small className="text-muted">Cobrado - Asignado</small>
                      <div className="mt-1">
                        <small className="text-primary"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div
                      className="border rounded p-3 bg-danger bg-opacity-10"
                      onClick={() => abrirDesglose('deficit', '⚠️ Desglose de Déficit por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-exclamation-triangle fs-1 text-danger"></i>
                      <h6 className="text-muted mt-2 mb-1">Déficit</h6>
                      <h4 className="mb-0 text-danger">
                        {(() => {
                          // Calcular suma de déficits individuales (solo obras con balance negativo)
                          const desglose = statsPersonalizadas.desglosePorObra || [];
                          const deficitTotal = desglose.reduce((sum, obra) => {
                            const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
                            return balance < 0 ? sum + balance : sum;
                          }, 0);
                          return formatearMoneda(Math.abs(deficitTotal));
                        })()}
                      </h4>
                      <small className="text-muted">Déficit de obras individuales</small>
                      <div className="mt-1">
                        <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gráficos */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-chart-pie me-2"></i>Distribución Financiera</h6>
                      </div>
                      <div className="card-body">
                        {datosDistribucion.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={datosDistribucion}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {datosDistribucion.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => formatearMoneda(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center text-muted py-5">No hay datos financieros</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-chart-bar me-2"></i>Comparativo de Montos</h6>
                      </div>
                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={datosBarras}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="categoria" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatearMoneda(value)} />
                            <Legend />
                            <Bar dataKey="monto" fill="#007bff" name="Monto" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertas */}
                <div className="mt-4">
                {statsPersonalizadas.alertas && statsPersonalizadas.alertas.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-muted mb-3">
                      <i className="bi bi-bell-fill me-2"></i>
                      Alertas de Obras Seleccionadas ({statsPersonalizadas.alertas.length})
                    </h6>
                    <div className="row">
                      {statsPersonalizadas.alertas.map((alerta, index) => (
                        <div key={index} className="col-md-6 mb-2">
                          <div className={`alert alert-${alerta.tipo} mb-0 py-2`}>
                            <div className="d-flex align-items-start">
                              <span className="fs-4 me-2">{alerta.icono}</span>
                              <div className="flex-grow-1">
                                <strong className="d-block">{alerta.titulo}</strong>
                                <small className="d-block">{alerta.descripcion}</small>
                                {alerta.recomendacion && (
                                  <small className="d-block mt-1 fst-italic">
                                    <i className="bi bi-lightbulb me-1"></i>
                                    {alerta.recomendacion}
                                  </small>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top 10 Obras */}
                {topObras.length > 0 && (
                  <div className="card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0"><i className="fas fa-trophy me-2"></i>Top 10 Obras por Presupuesto</h6>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Posición</th>
                              <th>Obra</th>
                              <th className="text-end">Presupuesto</th>
                              <th className="text-end">Asignado</th>
                              <th className="text-end">Pagado</th>
                              <th className="text-end">Retirado</th>
                              <th className="text-end">Disponible</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topObras.map((obra, index) => (
                              <tr key={index}>
                                <td>
                                  <span className={`badge ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : index === 2 ? 'bg-info' : 'bg-light text-dark'}`}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}°`}
                                  </span>
                                </td>
                                <td className="fw-bold">{obra.nombreObra}</td>
                                <td className="text-end">{formatearMoneda(obra.totalPresupuesto)}</td>
                                <td className="text-end">{formatearMoneda(obra.totalCobrado)}</td>
                                <td className="text-end">{formatearMoneda(obra.totalPagado)}</td>
                                <td className="text-end">{formatearMoneda(obra.totalRetirado || 0)}</td>
                                <td className="text-end text-primary fw-bold">{formatearMoneda(obra.saldoDisponible)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>
            <button type="button" className="btn btn-success">
              <i className="fas fa-file-excel me-2"></i>
              Exportar Excel
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de Desglose por Obra */}
    {showDesglose && (() => {
      // ✅ Agregar obras independientes al desglose
      const desgloseBase = statsPersonalizadas?.desglosePorObra || [];

      // Deduplicar OI por nombreObra (clave única real), priorizando la que tenga totalPresupuesto > 0
      const oiMap = new Map();
      const oiCandidatas = obrasDisponibles.filter(obra => {
        if (!obra.esObraIndependiente) return false;
        if (obrasSeleccionadas.size > 0) return obrasSeleccionadas.has(obra.id);
        return true;
      });

      console.log(`🔍 [EstadisticasModal] OI candidatas antes de deduplicar:`, oiCandidatas.map(o => ({
        id: o.id,
        nombre: o.nombreObra,
        direccion: o.direccion,
        monto: o.totalPresupuesto || o.presupuestoEstimado || 0
      })));

      oiCandidatas.forEach(obra => {
        // ✅ Usar nombreObra + direccion como clave única
        // Si ambos están vacíos, usar ID para evitar colisiones incorrectas
        const nombre = obra.nombreObra || '';
        const dir = obra.direccion || '';
        const claveUnica = (nombre || dir) ? `${nombre}_${dir}`.trim() : `id_${obra.id}`;

        const monto = parseFloat(obra.totalPresupuesto || obra.presupuestoEstimado || 0);
        const existente = oiMap.get(claveUnica);

        if (!existente || monto > (existente.totalPresupuesto || 0)) {
          oiMap.set(claveUnica, {
            id: obra.id,
            obraId: obra.id,
            nombreObra: obra.nombreObra || obra.direccion || `Obra ${obra.id}`,
            numeroPresupuesto: null,
            estado: obra.estado || 'APROBADO',
            totalPresupuesto: monto,
            esObraIndependiente: true,
            totalCobrado: 0,
            totalPagado: 0,
            totalRetirado: 0,
            saldoDisponible: 0
          });
        }
      });
      const obrasIndependientesParaDesglose = Array.from(oiMap.values());

      console.log(`✅ [EstadisticasModal] OI deduplicadas (${obrasIndependientesParaDesglose.length}):`, obrasIndependientesParaDesglose.map(o => ({
        id: o.id,
        nombre: o.nombreObra,
        monto: o.totalPresupuesto
      })));

      const datosDesglose = [...desgloseBase, ...obrasIndependientesParaDesglose];

      return (
        <DetalleConsolidadoPorObraModal
          show={showDesglose}
          onHide={() => setShowDesglose(false)}
          tipo={desgloseTipo}
          datos={datosDesglose}
          titulo={desgloseTitulo}
          estadisticas={statsPersonalizadas}
          empresaSeleccionada={empresaSeleccionada}
        />
      );
    })()}

    {/* Modal de Distribución de Cobros por Obra */}
    {showDistribucionCobros && (
      <DetalleDistribucionCobrosModal
        show={showDistribucionCobros}
        onHide={() => setShowDistribucionCobros(false)}
        datos={statsPersonalizadas?.desglosePorObra || []}
        estadisticas={statsPersonalizadas}
      />
    )}
    </>
  );
};

export default EstadisticasTodasObrasModal;
