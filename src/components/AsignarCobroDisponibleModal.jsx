import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { formatearMoneda, formatearFecha } from '../services/cobrosObraService';
import { listarCobrosEmpresa, asignarCobroAObras, obtenerDetalleCobroEmpresa, eliminarAsignacionCobroEmpresa, obtenerDistribucionPorObra } from '../services/cobrosEmpresaService';
import { actualizarAsignacion, obtenerAsignacionesDeObra } from '../services/asignacionesCobroObraService';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Modal para ASIGNAR SALDO DISPONIBLE
 * - Selecciona un cobro existente con saldo
 * - Distribuye ese saldo entre una o varias obras
 * - No crea cobros nuevos, solo asigna existentes
 */
const AsignarCobroDisponibleModal = memo(({ show, onHide, onSuccess }) => {
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
    montoGastosGenerales: 0,
    montoTrabajosExtra: 0
  });
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Cargar cobros disponibles y asignaciones existentes al abrir
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarCobrosDisponibles();
      cargarObrasDisponibles();
      cargarAsignacionesExistentes();
    }

    if (show) {
      resetForm();
    }
  }, [show, empresaSeleccionada]);

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
                                (obra.montoGastosGenerales || 0) +
                                (obra.montoTrabajosExtra || 0);
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
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);

      let presupuestosData = Array.isArray(response) ? response :
                             response?.datos ? response.datos :
                             response?.content ? response.content :
                             response?.data ? response.data : [];

      // Filtrar solo APROBADO y EN_EJECUCION
      const estadosPermitidos = ['APROBADO', 'EN_EJECUCION'];
      presupuestosData = presupuestosData.filter(p => estadosPermitidos.includes(p.estado));

      // Agrupar por obra y quedarse solo con la última versión
      const obrasPorDireccion = {};
      presupuestosData.forEach(p => {
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

      // Convertir a formato de obras
      const obras = presupuestosUnicos.map(p => ({
        obraId: p.obraId || p.id,
        presupuestoNoClienteId: p.id,
        barrio: p.direccionObraBarrio || null,
        calle: p.direccionObraCalle || '',
        altura: p.direccionObraAltura || '',
        ciudad: p.direccionObraCiudad || '',
        numero: p.direccionObraAltura || ''
      }));

      setObrasDisponibles(obras);

      // Inicializar distribución
      const distInicial = obras.map(obra => ({
        obra: obra,
        monto: 0,
        porcentaje: 0
      }));
      setDistribucion(distInicial);
    } catch (err) {
      console.error('Error cargando obras:', err);
      setError('Error al cargar las obras disponibles');
    }
  };

  const formatearDireccion = (obra) => {
    if (!obra) return 'Obra sin dirección';
    const direccionCompleta = `${obra.calle || ''} ${obra.numero || ''}, ${obra.ciudad || ''}`.trim();
    return direccionCompleta || `Obra #${obra.presupuestoNoClienteId || obra.id}`;
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

    const nuevaDistribucion = distribucion.map(d => {
      if (obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId)) {
        return {
          ...d,
          monto: montoPorObra,
          porcentaje: porcentajePorObra
        };
      }
      return { ...d, monto: 0, porcentaje: 0 };
    });

    setDistribucion(nuevaDistribucion);
  }, [cobroSeleccionado, obrasSeleccionadas, distribucion]);

  // Memoizar cálculo de totales para evitar recalcular en cada render
  const totales = useMemo(() => {
    const obrasConMonto = distribucion.filter(d =>
      obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) &&
      parseFloat(d.monto) > 0
    );

    let totalMonto = 0;

    // Para cada obra, si tiene distribución por items, sumar los items; si no, sumar el monto de la obra
    obrasConMonto.forEach(d => {
      const obraId = d.obra.presupuestoNoClienteId;
      const distObra = distribucionPorObra[obraId];
      const estaExpandida = obrasExpandidas.includes(obraId);

      if (estaExpandida && distObra) {
        // Si está expandida, sumar los items distribuidos
        const totalItems = parseFloat(distObra.profesionales?.monto || 0) +
                          parseFloat(distObra.materiales?.monto || 0) +
                          parseFloat(distObra.gastosGenerales?.monto || 0) +
                          parseFloat(distObra.trabajosExtra?.monto || 0);
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
              gastosGenerales: { monto: 0, porcentaje: 0 },
              trabajosExtra: { monto: 0, porcentaje: 0 }
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
    const montoObra = distribucion.find(d => d.obra.presupuestoNoClienteId === obraId)?.monto || 0;
    if (montoObra === 0) return;

    const distActual = distribucionPorObra[obraId] || {
      profesionales: { monto: 0, porcentaje: 0 },
      materiales: { monto: 0, porcentaje: 0 },
      gastosGenerales: { monto: 0, porcentaje: 0 },
      trabajosExtra: { monto: 0, porcentaje: 0 }
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
    const obrasConMonto = distribucion.filter(d =>
      obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) &&
      parseFloat(d.monto) > 0
    );

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
        const distObra = distribucionPorObra[d.obra.presupuestoNoClienteId];

        const asignacion = {
          obraId: d.obra.obraId,
          montoAsignado: parseFloat(d.monto),
          descripcion: `${d.porcentaje.toFixed(1)}% del cobro #${cobroSeleccionado.id} - ${formatearDireccion(d.obra)}`
        };

        // Añadir distribución por ítems si existe
        if (distObra) {
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
          if (parseFloat(distObra.trabajosExtra?.monto || 0) > 0) {
            distribucionItems.montoTrabajosExtra = parseFloat(distObra.trabajosExtra.monto);
            distribucionItems.porcentajeTrabajosExtra = parseFloat(distObra.trabajosExtra.porcentaje);
          }

          if (Object.keys(distribucionItems).length > 0) {
            asignacion.distribucionItems = distribucionItems;
          }
        }

        return asignacion;
      });

      console.log('🚀 Asignando cobro #' + cobroSeleccionado.id + ' a obras:', JSON.stringify(asignaciones, null, 2));
      console.log('📊 Obras con monto:', obrasConMonto.map(d => ({
        presupuestoNoClienteId: d.obra.presupuestoNoClienteId,
        obraId: d.obra.obraId,
        monto: d.monto
      })));
      const resultado = await asignarCobroAObras(cobroSeleccionado.id, asignaciones, empresaSeleccionada.id);
      console.log('✅ Asignación exitosa:', resultado);

      // Notificar por cada obra
      obrasConMonto.forEach(d => {
        eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
          presupuestoId: d.obra.presupuestoNoClienteId,
          monto: parseFloat(d.monto)
        });
      });

      const mensajeExito = `✅ Se asignó ${formatearMoneda(totalAsignar)} del cobro #${cobroSeleccionado.id} a ${obrasConMonto.length} obra(s)`;
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
                                                          (obra.montoGastosGenerales || 0) +
                                                          (obra.montoTrabajosExtra || 0);
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
                                              montoGastosGenerales: obra.montoGastosGenerales || 0,
                                              montoTrabajosExtra: obra.montoTrabajosExtra || 0
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
                              <i className="bi bi-distribute-vertical"></i> Distribuir por Ítems
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
                                          setObrasSeleccionadas(obrasDisponibles.map(o => o.presupuestoNoClienteId));
                                        } else {
                                          setObrasSeleccionadas([]);
                                        }
                                      }}
                                    />
                                  </th>
                                  <th>Obra</th>
                                  <th width="150" className="text-end">Monto ($)</th>
                                  <th width="100" className="text-end text-muted">%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {distribucion.map((d, index) => {
                                  const isSelected = obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId);
                                  const isExpanded = obrasExpandidas.includes(d.obra.presupuestoNoClienteId);
                                  const distObra = distribucionPorObra[d.obra.presupuestoNoClienteId];

                                  return (
                                    <React.Fragment key={d.obra.presupuestoNoClienteId}>
                                      <tr className={isSelected ? 'table-success' : ''}>
                                        <td>
                                          <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={isSelected}
                                            onChange={() => toggleObraSeleccionada(d.obra.presupuestoNoClienteId)}
                                          />
                                        </td>
                                        <td>
                                          <div className="d-flex align-items-center">
                                            {isSelected && parseFloat(d.monto) > 0 && (
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary me-2"
                                                onClick={() => toggleObraExpandida(d.obra.presupuestoNoClienteId)}
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
                                            {isSelected && parseFloat(d.monto) === 0 && (
                                              <small className="text-muted me-2">
                                                <i className="bi bi-info-circle"></i> Asigne un monto primero
                                              </small>
                                            )}
                                            <small>{formatearDireccion(d.obra)}</small>
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
                                      {isExpanded && isSelected && parseFloat(d.monto) > 0 && (
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
                                                    className={`btn btn-sm ${(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                    onClick={() => handleCambiarTipoDistribucionObra(d.obra.presupuestoNoClienteId, 'MONTO')}
                                                  >
                                                    Por Monto
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={`btn btn-sm ${(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'PORCENTAJE' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                    onClick={() => handleCambiarTipoDistribucionObra(d.obra.presupuestoNoClienteId, 'PORCENTAJE')}
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
                                                        placeholder={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.profesionales?.monto || '')
                                                          : (distObra?.profesionales?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          d.obra.presupuestoNoClienteId,
                                                          'profesionales',
                                                          (tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
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
                                                        placeholder={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.materiales?.monto || '')
                                                          : (distObra?.materiales?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          d.obra.presupuestoNoClienteId,
                                                          'materiales',
                                                          (tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
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
                                                        placeholder={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.gastosGenerales?.monto || '')
                                                          : (distObra?.gastosGenerales?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          d.obra.presupuestoNoClienteId,
                                                          'gastosGenerales',
                                                          (tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
                                                          ? `${(distObra?.gastosGenerales?.porcentaje || 0).toFixed(2)}%`
                                                          : formatearMoneda(parseFloat(distObra?.gastosGenerales?.monto || 0))
                                                        }
                                                      </small>
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Trabajos Extra */}
                                                <div className="col-md-3">
                                                  <div className="card border">
                                                    <div className="card-body p-2">
                                                      <div className="mb-1">
                                                        <small className="fw-bold">
                                                          <i className="bi bi-hammer text-info me-1"></i>
                                                          Trabajos Extra
                                                        </small>
                                                      </div>
                                                      <input
                                                        type="number"
                                                        className="form-control form-control-sm mb-1"
                                                        placeholder={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                        value={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
                                                          ? (distObra?.trabajosExtra?.monto || '')
                                                          : (distObra?.trabajosExtra?.porcentaje || '')}
                                                        onChange={(e) => handleDistribucionItemsChange(
                                                          d.obra.presupuestoNoClienteId,
                                                          'trabajosExtra',
                                                          (tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? 'monto' : 'porcentaje',
                                                          e.target.value
                                                        )}
                                                        min="0"
                                                        step={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO' ? '0.01' : '0.1'}
                                                        max={(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'PORCENTAJE' ? '100' : undefined}
                                                        style={{
                                                          MozAppearance: 'textfield',
                                                          WebkitAppearance: 'none',
                                                          appearance: 'textfield'
                                                        }}
                                                        onWheel={(e) => e.target.blur()}
                                                      />
                                                      <small className="text-muted">
                                                        {(tipoDistribucionPorObra[d.obra.presupuestoNoClienteId] || 'MONTO') === 'MONTO'
                                                          ? `${(distObra?.trabajosExtra?.porcentaje || 0).toFixed(2)}%`
                                                          : formatearMoneda(parseFloat(distObra?.trabajosExtra?.monto || 0))
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
                                                    (distObra?.gastosGenerales?.monto || 0) +
                                                    (distObra?.trabajosExtra?.monto || 0)
                                                  )}</span>
                                                </div>
                                                {(() => {
                                                  const totalDistribuido = (distObra?.profesionales?.monto || 0) +
                                                    (distObra?.materiales?.monto || 0) +
                                                    (distObra?.gastosGenerales?.monto || 0) +
                                                    (distObra?.trabajosExtra?.monto || 0);
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

                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      🔧 Trabajos Extra
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicionAsignacion.montoTrabajosExtra}
                      onChange={(e) => setFormEdicionAsignacion({...formEdicionAsignacion, montoTrabajosExtra: parseFloat(e.target.value) || 0})}
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
                    formEdicionAsignacion.montoGastosGenerales +
                    formEdicionAsignacion.montoTrabajosExtra
                  )}
                  <br />
                  {(formEdicionAsignacion.montoProfesionales + formEdicionAsignacion.montoMateriales +
                    formEdicionAsignacion.montoGastosGenerales + formEdicionAsignacion.montoTrabajosExtra) >
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
                                            formEdicionAsignacion.montoGastosGenerales +
                                            formEdicionAsignacion.montoTrabajosExtra;

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
                              montoTrabajosExtra: formEdicionAsignacion.montoTrabajosExtra,
                              // Calcular porcentajes
                              porcentajeProfesionales: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoProfesionales / asignacion.montoAsignado * 100)
                                : 0,
                              porcentajeMateriales: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoMateriales / asignacion.montoAsignado * 100)
                                : 0,
                              porcentajeGastosGenerales: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoGastosGenerales / asignacion.montoAsignado * 100)
                                : 0,
                              porcentajeTrabajosExtra: asignacion.montoAsignado > 0
                                ? (formEdicionAsignacion.montoTrabajosExtra / asignacion.montoAsignado * 100)
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
