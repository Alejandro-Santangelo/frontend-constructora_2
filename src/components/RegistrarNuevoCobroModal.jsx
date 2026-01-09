import React, { useState, useEffect, memo, useCallback } from 'react';
import { registrarCobro, formatearMoneda, formatearFecha } from '../services/cobrosObraService';
import { registrarCobroEmpresa, asignarCobroAObras } from '../services/cobrosEmpresaService';
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
  };

  const calcularTotales = () => {
    const obrasConMonto = distribucion.filter(d =>
      obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) &&
      parseFloat(d.monto) > 0
    );

    const totalMonto = obrasConMonto.reduce((sum, d) => sum + parseFloat(d.monto), 0);
    const totalPorcentaje = obrasConMonto.reduce((sum, d) => sum + parseFloat(d.porcentaje), 0);

    return { totalMonto, totalPorcentaje };
  };

  const toggleObraExpandida = (presupuestoId) => {
    setObrasExpandidas(prev =>
      prev.includes(presupuestoId)
        ? prev.filter(id => id !== presupuestoId)
        : [...prev, presupuestoId]
    );
  };

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
        ? distribucion.filter(d =>
            obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) &&
            parseFloat(d.monto) > 0
          )
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
          const distObra = distribucionPorObra[d.obra.presupuestoNoClienteId];

          const asignacion = {
            obraId: d.obra.obraId,
            montoAsignado: parseFloat(d.monto),
            descripcion: `${d.porcentaje.toFixed(1)}% del cobro - ${formatearDireccion(d.obra)}`
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

        console.log('🚀 [PASO 2] Asignando a obras:', asignaciones);
        const resultado = await asignarCobroAObras(cobroCreado.id, asignaciones, empresaSeleccionada.id);
        console.log('✅ Asignación exitosa:', resultado);

        // Notificar por cada obra
        obrasConMonto.forEach(d => {
          eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
            presupuestoId: d.obra.presupuestoNoClienteId,
            monto: parseFloat(d.monto)
          });
        });
      }

      const mensajeExito = obrasConMonto.length === 0
        ? `✅ Cobro de ${formatearMoneda(montoTotalNum)} registrado - Disponible para asignar`
        : `✅ Cobro registrado y asignado a ${obrasConMonto.length} obra(s)`;

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
