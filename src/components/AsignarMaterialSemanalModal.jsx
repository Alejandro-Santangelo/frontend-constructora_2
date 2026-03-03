import React, { useEffect, useMemo, useState } from 'react';
import { useEmpresa } from '../EmpresaContext';
import { obtenerMateriales, obtenerOCrearMaterial } from '../services/catalogoMaterialesService';

const AsignarMaterialSemanalModal = ({
  show,
  onClose,
  obra,
  numeroSemana,
  diasSemana = [],
  materialesDisponibles = [],
  modoPresupuesto = 'DETALLE', // 'GLOBAL', 'DETALLE' o 'MIXTO'
  cantidadGlobalDisponible = 0,
  onConfirmarAsignacion
}) => {
  const { empresaSeleccionada } = useEmpresa();
  const [tipoAsignacion, setTipoAsignacion] = useState(
    modoPresupuesto === 'GLOBAL' || (materialesDisponibles?.length || 0) === 0
      ? 'CANTIDAD_GLOBAL'
      : 'ELEMENTO_DETALLADO'
  );
  const [materialSeleccionadoId, setMaterialSeleccionadoId] = useState('');
  const [cantidadTotal, setCantidadTotal] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [materialesCatalogo, setMaterialesCatalogo] = useState([]);

  const tieneItemsDetallados = (materialesDisponibles?.length || 0) > 0;
  // ⚠️ NOTA: Backend aún no soporta materiales manuales (solo presupuesto)
  // Habilitado temporalmente - guardará en localStorage hasta que backend lo soporte
  const permiteManual = true;

  useEffect(() => {
    console.log('🔍 [AsignarMaterialSemanalModal] Debug:', {
      show,
      tieneItemsDetallados,
      materialesDisponibles: materialesDisponibles?.length,
      modoPresupuesto,
      permiteManual,
      tipoAsignacion
    });
    if (!show) return;
    if (!tieneItemsDetallados) {
      console.log('⚠️ No hay items detallados - forzando CANTIDAD_GLOBAL');
      setTipoAsignacion('CANTIDAD_GLOBAL');
      setMaterialSeleccionadoId('');
    }
  }, [show, tieneItemsDetallados, tipoAsignacion, modoPresupuesto, permiteManual]);

  // 🔥 Cargar materiales del catálogo de BD
  useEffect(() => {
    const cargarMaterialesCatalogo = async () => {
      if (show && empresaSeleccionada?.id) {
        try {
          const materiales = await obtenerMateriales(empresaSeleccionada.id);
          setMaterialesCatalogo(materiales || []);
          console.log(`✅ ${materiales?.length || 0} materiales cargados del catálogo (semanal)`);
        } catch (error) {
          console.error('❌ Error cargando materiales del catálogo (semanal):', error);
        }
      }
    };
    cargarMaterialesCatalogo();
  }, [show, empresaSeleccionada?.id]);

  // 🔥 Cargar materiales del catálogo de BD
  useEffect(() => {
    const cargarMaterialesCatalogo = async () => {
      if (show && empresaSeleccionada?.id) {
        try {
          const materiales = await obtenerMateriales(empresaSeleccionada.id);
          setMaterialesCatalogo(materiales || []);
          console.log(`✅ ${materiales?.length || 0} materiales cargados del catálogo (semanal)`);
        } catch (error) {
          console.error('❌ Error cargando materiales del catálogo (semanal):', error);
        }
      }
    };
    cargarMaterialesCatalogo();
  }, [show, empresaSeleccionada?.id]);

  // Estado para creación rápida de material manual
  const [nuevoMaterialManual, setNuevoMaterialManual] = useState({
    nombre: '',
    unidad: 'un',
    unidadCustom: '',
    precioUnitario: '' // 🔥 NUEVO: Precio unitario
  });

  const unidadesMedida = ['un', 'kg', 'm', 'm²', 'm³', 'l', 'bolsa', 'otro'];

  const obtenerUnidadFinal = () => {
    if (nuevoMaterialManual.unidad === 'otro') {
      return (nuevoMaterialManual.unidadCustom || '').trim();
    }
    return nuevoMaterialManual.unidad;
  };

  // Función para calcular stock real disponible (considerando asignaciones locales)
  const calcularStockDisponible = (materialId) => {
    const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
    const asignacionesLocales = JSON.parse(localStorage.getItem(key) || '[]');

    const totalAsignadoLocal = asignacionesLocales
      .filter(a => (a.presupuestoMaterialId === materialId || a.materialId === materialId))
      .reduce((sum, a) => sum + (parseFloat(a.cantidadAsignada) || 0), 0);

    const materialOriginal = materialesDisponibles.find(m => m.id === materialId);
    if (!materialOriginal) return 0;

    const disponibleReal = (materialOriginal.cantidadDisponible || 0) - totalAsignadoLocal;
    return Math.max(0, disponibleReal);
  };

  // Función para obtener estado de stock actualizado
  const getEstadoStockActualizado = (materialId) => {
    const disponibleReal = calcularStockDisponible(materialId);

    if (disponibleReal === 0) return 'AGOTADO';
    if (disponibleReal <= 10) return 'STOCK_BAJO';
    return 'DISPONIBLE';
  };

  const materialSeleccionado = useMemo(() => {
    if (!materialSeleccionadoId) return null;
    // Buscar en el catálogo de materiales
    const materialCatalogo = materialesCatalogo.find(m => m.id.toString() === materialSeleccionadoId.toString());
    if (materialCatalogo) return materialCatalogo;
    // Fallback a materialesDisponibles si no se encuentra en el catálogo
    return materialesDisponibles.find(m => m.id.toString() === materialSeleccionadoId.toString()) || null;
  }, [materialSeleccionadoId, materialesCatalogo, materialesDisponibles]);

  const handleConfirmar = async () => {
    if (procesando) {
      return;
    }
    setProcesando(true);

    const cantidadNum = parseFloat(cantidadTotal) || 0;

    if (tipoAsignacion === 'CANTIDAD_GLOBAL') {
      if (!nuevoMaterialManual.nombre.trim()) {
        alert('⚠️ Debe ingresar un nombre para el material');
        setProcesando(false);
        return;
      }
      if (nuevoMaterialManual.unidad === 'otro' && !obtenerUnidadFinal()) {
        alert('⚠️ Si seleccionas "otro", debes escribir la unidad');
        setProcesando(false);
        return;
      }
      if (cantidadNum <= 0) {
        alert('⚠️ La cantidad debe ser mayor a cero');
        setProcesando(false);
        return;
      }
      // 🔥 Validar precio unitario
      const precioNum = parseFloat(nuevoMaterialManual.precioUnitario) || 0;
      if (precioNum <= 0) {
        alert('⚠️ El precio unitario debe ser mayor a cero');
        setProcesando(false);
        return;
      }
      if (modoPresupuesto === 'GLOBAL' && cantidadNum > cantidadGlobalDisponible) {
        alert(`⚠️ La cantidad (${cantidadNum}) excede la disponible (${cantidadGlobalDisponible})`);
        setProcesando(false);
        return;
      }

      // 🔥 Crear/Obtener material del catálogo de BD
      try {
        const materialCatalogo = await obtenerOCrearMaterial(
          nuevoMaterialManual.nombre,
          obtenerUnidadFinal(),
          precioNum,
          empresaSeleccionada.id
        );
        console.log('✅ Material verificado/creado en catálogo (semanal):', materialCatalogo);
      } catch (error) {
        console.error('❌ Error creando/verificando material en catálogo:', error);
        alert(`❌ Error al guardar el material: ${error.message}`);
        setProcesando(false);
        return;
      }
    } else {
      if (!materialSeleccionadoId) {
        alert('⚠️ Por favor seleccione un material del catálogo');
        setProcesando(false);
        return;
      }
      if (cantidadNum <= 0) {
        alert('⚠️ La cantidad debe ser mayor a cero');
        setProcesando(false);
        return;
      }
    }

    const idMaterial = tipoAsignacion === 'CANTIDAD_GLOBAL'
      ? `MANUAL_${Date.now()}`
      : materialSeleccionadoId;

    const nombreMaterial = tipoAsignacion === 'CANTIDAD_GLOBAL'
      ? nuevoMaterialManual.nombre
      : (materialSeleccionado?.nombre || 'Material');

    const unidadMedida = tipoAsignacion === 'CANTIDAD_GLOBAL'
      ? obtenerUnidadFinal()
      : (materialSeleccionado?.unidadMedida || materialSeleccionado?.unidad || '');

    // Para materiales del catálogo (ELEMENTO_DETALLADO), no validar stock ya que no lo manejamos
    // El stock se valida en las asignaciones de obra, no en el catálogo

    const precioUnitario = tipoAsignacion === 'CANTIDAD_GLOBAL'
      ? (parseFloat(nuevoMaterialManual.precioUnitario) || 0)
      : (materialSeleccionado?.precioUnitario || parseFloat(nuevoMaterialManual.precioUnitario) || 0);

    const asignacionSemanal = {
      materialId: idMaterial,
      nombreMaterial,
      unidadMedida,
      cantidad: cantidadNum,
      precioUnitario: precioUnitario,
      numeroSemana,
      observaciones: observaciones + (tipoAsignacion === 'CANTIDAD_GLOBAL' ? ' [Para toda la Semana]' : ' [Material Semanal Detallado]'),
      esManual: tipoAsignacion === 'CANTIDAD_GLOBAL',
      esSemanal: true
    };

    const asignacionesSemana = [asignacionSemanal];

    if (onConfirmarAsignacion) {
      await onConfirmarAsignacion(asignacionesSemana);
    }

    setProcesando(false);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1070}}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-calendar-week me-2"></i>
              Asignación de Materiales - Semana {numeroSemana}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body p-4">
            {/* 💰 MOSTRAR PRESUPUESTO GLOBAL DISPONIBLE */}
            {modoPresupuesto === 'GLOBAL' && cantidadGlobalDisponible > 0 && (
              <div className="alert alert-success border-0 shadow-sm mb-4">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <i className="fas fa-box-open me-2"></i>
                    <strong>Presupuesto Global de Materiales</strong>
                  </div>
                  <div className="fs-4 fw-bold text-success">
                    $ {cantidadGlobalDisponible.toLocaleString('es-AR')}
                  </div>
                </div>
                <small className="text-muted d-block mt-1">
                  Cantidad global disponible para asignar
                </small>
              </div>
            )}

            <div className="alert alert-info border-0 shadow-sm d-flex align-items-center mb-4">
              <i className="fas fa-info-circle fs-4 me-3"></i>
              <div>
                Configure la asignación para toda la semana {numeroSemana}.
              </div>
            </div>

            {/* Selector de Tipo de Asignación: Global vs Detallado */}
            <div className="card mb-4 border-0 bg-light">
              <div className="card-body">
                <label className="form-label fw-bold text-primary mb-3">
                  <i className="fas fa-layer-group me-2"></i>
                  Tipo de asignación de material
                </label>
                <div className="d-flex gap-3">
                  {permiteManual && (
                    <div
                      className={`flex-fill p-3 border rounded cursor-pointer transition-all ${tipoAsignacion === 'CANTIDAD_GLOBAL' ? 'border-primary bg-white shadow-sm' : 'bg-white text-muted opacity-75'}`}
                      style={{ cursor: 'pointer', border: tipoAsignacion === 'CANTIDAD_GLOBAL' ? '2px solid' : '1px solid' }}
                      onClick={() => setTipoAsignacion('CANTIDAD_GLOBAL')}
                    >
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          checked={tipoAsignacion === 'CANTIDAD_GLOBAL'}
                          onChange={() => setTipoAsignacion('CANTIDAD_GLOBAL')}
                        />
                        <label className="form-check-label fw-bold">➕ Crear Nuevo Material</label>
                      </div>
                      <small className="d-block mt-1 text-muted">
                        Crear un nuevo material en el catálogo
                        {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && ` ($ ${cantidadGlobalDisponible.toLocaleString('es-AR')} disponibles)`}
                      </small>
                    </div>
                  )}
                  {tieneItemsDetallados && (
                    <div
                      className={`flex-fill p-3 border rounded cursor-pointer transition-all ${tipoAsignacion === 'ELEMENTO_DETALLADO' ? 'border-primary bg-white shadow-sm' : 'bg-white text-muted opacity-75'}`}
                      style={{ cursor: 'pointer', border: tipoAsignacion === 'ELEMENTO_DETALLADO' ? '2px solid' : '1px solid' }}
                      onClick={() => setTipoAsignacion('ELEMENTO_DETALLADO')}
                    >
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          checked={tipoAsignacion === 'ELEMENTO_DETALLADO'}
                          onChange={() => setTipoAsignacion('ELEMENTO_DETALLADO')}
                        />
                        <label className="form-check-label fw-bold">Material del Catálogo</label>
                      </div>
                      <small className="d-block mt-1 text-muted">Seleccionar material existente del catálogo</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="row g-3">
              {tipoAsignacion === 'CANTIDAD_GLOBAL' ? (
                <>
                  <div className="col-md-7">
                    <label className="form-label fw-bold">Nombre del Material *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Ej: Cemento, Arena, Ladrillos..."
                      value={nuevoMaterialManual.nombre}
                      onChange={(e) => setNuevoMaterialManual({...nuevoMaterialManual, nombre: e.target.value})}
                    />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-bold">Unidad de Medida</label>
                    <select
                      className="form-select form-select-lg"
                      value={nuevoMaterialManual.unidad}
                      onChange={(e) => setNuevoMaterialManual({
                        ...nuevoMaterialManual,
                        unidad: e.target.value,
                        unidadCustom: e.target.value === 'otro' ? (nuevoMaterialManual.unidadCustom || '') : ''
                      })}
                    >
                      {unidadesMedida.map(unidad => (
                        <option key={unidad} value={unidad}>{unidad}</option>
                      ))}
                    </select>
                    {nuevoMaterialManual.unidad === 'otro' && (
                      <input
                        type="text"
                        className="form-control mt-2"
                        placeholder="Escribí la unidad..."
                        value={nuevoMaterialManual.unidadCustom}
                        onChange={(e) => setNuevoMaterialManual({...nuevoMaterialManual, unidadCustom: e.target.value})}
                        required
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="col-md-12">
                  <label className="form-label fw-bold">Material del Catálogo *</label>
                  <select
                    className="form-select form-select-lg"
                    value={materialSeleccionadoId}
                    onChange={(e) => {
                      const valorSeleccionado = e.target.value;
                      setMaterialSeleccionadoId(valorSeleccionado);

                      // Auto-completar precio unitario del catálogo
                      if (valorSeleccionado) {
                        const materialCatalogo = materialesCatalogo.find(m => m.id.toString() === valorSeleccionado);
                        if (materialCatalogo && materialCatalogo.precioUnitario) {
                          setNuevoMaterialManual({
                            ...nuevoMaterialManual,
                            precioUnitario: materialCatalogo.precioUnitario.toString(),
                            nombre: materialCatalogo.nombre,
                            unidad: materialCatalogo.unidadMedida || 'un'
                          });
                        }
                      }
                    }}
                  >
                    <option value="">Seleccionar material del catálogo...</option>
                    {materialesCatalogo.length === 0 && (
                      <option disabled style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        Cargando materiales...
                      </option>
                    )}
                    {materialesCatalogo.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.nombre} {material.unidadMedida ? `(${material.unidadMedida})` : ''} - ${Number(material.precioUnitario || 0).toLocaleString('es-AR')}
                      </option>
                    ))}
                  </select>
                  {materialesCatalogo.length === 0 && (
                    <div className="alert alert-info mt-3 mb-0">
                      <i className="fas fa-info-circle me-2"></i>
                      Cargando materiales del catálogo...
                    </div>
                  )}
                </div>
              )}

              <div className="col-md-6">
                <label className="form-label fw-bold">Cantidad Total *</label>
                <div className="input-group input-group-lg">
                  <input
                    type="number"
                    className="form-control"
                    step="0.01"
                    min="0.01"
                    placeholder="Cantidad"
                    value={cantidadTotal}
                    onChange={(e) => setCantidadTotal(e.target.value)}
                  />
                  <span className="input-group-text">
                    {tipoAsignacion === 'CANTIDAD_GLOBAL' ? obtenerUnidadFinal() : (materialSeleccionado?.unidadMedida || materialSeleccionado?.unidad || 'un')}
                  </span>
                </div>
              </div>

              {/* 🔥 Campo Precio Unitario (siempre visible) */}
              <div className="col-md-6">
                <label className="form-label fw-bold">Precio Unitario *</label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={nuevoMaterialManual.precioUnitario}
                    onChange={(e) => setNuevoMaterialManual({...nuevoMaterialManual, precioUnitario: e.target.value})}
                    disabled={tipoAsignacion === 'ELEMENTO_DETALLADO' && materialSeleccionadoId}
                  />
                </div>
                {nuevoMaterialManual.precioUnitario && cantidadTotal && (
                  <small className="text-muted mt-1 d-block">
                    Total: ${(Number(nuevoMaterialManual.precioUnitario) * Number(cantidadTotal)).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </small>
                )}
              </div>
            </div>

            {/* Observaciones */}
            <div className="mb-3">
              <label className="form-label fw-bold">Observaciones (opcional)</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Notas adicionales sobre esta asignación..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              ></textarea>
            </div>

          </div>

          <div className="modal-footer bg-light border-top-0 p-3">
            <button
              type="button"
              className="btn btn-outline-secondary px-4"
              onClick={onClose}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary px-4 shadow-sm"
              onClick={handleConfirmar}
              disabled={
                procesando ||
                (tipoAsignacion === 'ELEMENTO_DETALLADO' && !materialSeleccionado) ||
                !cantidadTotal
              }
            >
              <i className="fas fa-check-circle me-2"></i>
              Confirmar Asignación Semanal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsignarMaterialSemanalModal;
