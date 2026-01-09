import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext';

const AsignarMaterialSemanalModal = ({ 
  show, 
  onClose, 
  obra, 
  numeroSemana,
  diasSemana = [],
  materialesDisponibles = [],
  onConfirmarAsignacion
}) => {
  const { empresaSeleccionada } = useEmpresa();
  const [materialSeleccionado, setMaterialSeleccionado] = useState('');
  const [cantidadTotal, setCantidadTotal] = useState('');
  const [tipoDistribucion, setTipoDistribucion] = useState('uniforme'); // 'uniforme' o 'proporcional'
  const [observaciones, setObservaciones] = useState('');
  const [distribuciones, setDistribuciones] = useState({});

  // Función para calcular stock real disponible
  const calcularStockDisponible = (materialId) => {
    const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
    const asignacionesExistentes = JSON.parse(localStorage.getItem(key) || '[]');
    
    // Sumar todas las cantidades asignadas de este material
    const totalAsignado = asignacionesExistentes
      .filter(a => a.materialId === materialId)
      .reduce((sum, a) => sum + (a.cantidadAsignada || 0), 0);
    
    // Encontrar el material original
    const materialOriginal = materialesDisponibles.find(m => m.id === materialId);
    if (!materialOriginal) return 0;
    
    // Calcular disponible real
    const disponibleReal = (materialOriginal.cantidadDisponible || 0) - totalAsignado;
    return Math.max(0, disponibleReal);
  };

  // Función para obtener estado de stock actualizado
  const getEstadoStockActualizado = (materialId) => {
    const disponibleReal = calcularStockDisponible(materialId);
    
    if (disponibleReal === 0) return 'AGOTADO';
    if (disponibleReal <= 10) return 'STOCK_BAJO';
    return 'DISPONIBLE';
  };

  // Calcular distribución automática
  const calcularDistribucion = () => {
    if (!cantidadTotal || !materialSeleccionado) return {};
    
    const cantidad = parseFloat(cantidadTotal);
    const dias = diasSemana.length;
    
    if (tipoDistribucion === 'uniforme') {
      // Distribución uniforme
      const cantidadPorDia = Math.floor(cantidad / dias);
      const resto = cantidad % dias;
      
      const distribucion = {};
      diasSemana.forEach((dia, index) => {
        distribucion[dia.fechaStr] = cantidadPorDia + (index < resto ? 1 : 0);
      });
      return distribucion;
    } else {
      // Distribución proporcional (más en días centrales)
      const factores = [0.15, 0.25, 0.30, 0.25, 0.05]; // L, M, X, J, V
      const distribucion = {};
      diasSemana.forEach((dia, index) => {
        const factor = factores[index] || 0.2;
        distribucion[dia.fechaStr] = Math.round(cantidad * factor);
      });
      return distribucion;
    }
  };

  const distribucionCalculada = calcularDistribucion();

  const handleConfirmar = () => {
    if (!materialSeleccionado || !cantidadTotal) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    const material = materialesDisponibles.find(m => m.id === materialSeleccionado);
    
    // Validar stock antes de proceder
    if (!material) {
      alert('Material no encontrado');
      return;
    }
    
    const disponibleReal = calcularStockDisponible(material.id);
    const estadoReal = getEstadoStockActualizado(material.id);
    
    if (estadoReal === 'AGOTADO') {
      alert('No se puede asignar material agotado');
      return;
    }
    
    const cantidadTotalNum = parseFloat(cantidadTotal);
    if (cantidadTotalNum > disponibleReal) {
      alert(`Stock insuficiente. Disponible: ${disponibleReal}, Solicitado: ${cantidadTotalNum}`);
      return;
    }
    
    const asignacionesSemana = diasSemana.map(dia => ({
      materialId: materialSeleccionado,
      nombreMaterial: material.nombre,
      cantidad: distribucionCalculada[dia.fechaStr] || 0,
      fechaAsignacion: dia.fechaStr,
      numeroSemana: numeroSemana, // 🔥 NUEVO: incluir número de semana
      observaciones: observaciones + ` (Semana ${numeroSemana} - ${tipoDistribucion})`
    })).filter(a => a.cantidad > 0);

    if (onConfirmarAsignacion) {
      onConfirmarAsignacion(asignacionesSemana);
    }
    
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1070}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-calendar-week me-2"></i>
              Asignar Material para Toda la Semana {numeroSemana}
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info">
              <i className="fas fa-info-circle me-2"></i>
              Configure la asignación para toda la semana. El material se distribuirá automáticamente 
              entre los {diasSemana.length} días hábiles según el tipo de distribución seleccionado.
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Material *</label>
                <select 
                  className="form-select"
                  value={materialSeleccionado}
                  onChange={(e) => setMaterialSeleccionado(e.target.value)}
                >
                  <option value="">Seleccione un material...</option>
                  {materialesDisponibles.map(material => {
                    const disponibleReal = calcularStockDisponible(material.id);
                    const stockOriginal = material.cantidadDisponible || 0;
                    const estadoReal = getEstadoStockActualizado(material.id);
                    const icono = {
                      'DISPONIBLE': '🟢',
                      'STOCK_BAJO': '🟡', 
                      'AGOTADO': '🔴',
                      'SIN_STOCK': '⚪'
                    }[estadoReal];
                    
                    // Mostrar información más completa si hay diferencia
                    const infoStock = disponibleReal !== stockOriginal 
                      ? `${disponibleReal}/${stockOriginal}` 
                      : `${disponibleReal}`;
                    
                    return (
                      <option 
                        key={material.id} 
                        value={material.id}
                        disabled={estadoReal === 'AGOTADO'}
                        style={{ color: estadoReal === 'AGOTADO' ? '#dc3545' : '#000' }}
                      >
                        {icono} {material.nombre} - {infoStock} disponibles ({material.unidad})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Cantidad Total *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Cantidad total"
                  step="0.01"
                  min="0"
                  value={cantidadTotal}
                  onChange={(e) => setCantidadTotal(e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Distribución</label>
                <select 
                  className="form-select"
                  value={tipoDistribucion}
                  onChange={(e) => setTipoDistribucion(e.target.value)}
                >
                  <option value="uniforme">Uniforme</option>
                  <option value="proporcional">Proporcional</option>
                </select>
              </div>

              {/* Componente AlertaStock para modal semanal */}
              {materialSeleccionado && (() => {
                const materialSel = materialesDisponibles.find(m => m.id === materialSeleccionado);
                if (!materialSel) return null;
                
                const disponibleReal = calcularStockDisponible(materialSel.id);
                const estadoReal = getEstadoStockActualizado(materialSel.id);
                
                if (estadoReal === 'STOCK_BAJO') {
                  return (
                    <div className="col-12">
                      <div className="alert alert-warning d-flex align-items-center">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        ⚠️ Stock bajo: Solo quedan {disponibleReal} unidades
                      </div>
                    </div>
                  );
                } else if (estadoReal === 'AGOTADO') {
                  return (
                    <div className="col-12">
                      <div className="alert alert-danger d-flex align-items-center">
                        <i className="fas fa-times-circle me-2"></i>
                        🚫 Material agotado
                      </div>
                    </div>
                  );
                } else if (estadoReal === 'SIN_STOCK') {
                  return (
                    <div className="col-12">
                      <div className="alert alert-info d-flex align-items-center">
                        <i className="fas fa-info-circle me-2"></i>
                        ℹ️ Contactar administrador
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="col-12">
                <label className="form-label">Observaciones</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Observaciones opcionales para toda la semana..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                ></textarea>
              </div>
            </div>

            {/* Preview de distribución */}
            {cantidadTotal && materialSeleccionado && (
              <div className="mt-4">
                <h6 className="text-primary">
                  <i className="fas fa-eye me-2"></i>
                  Vista previa de distribución:
                </h6>
                <div className="row">
                  {diasSemana.map((dia, index) => (
                    <div key={index} className="col">
                      <div className="card text-center">
                        <div className="card-body py-2">
                          <small className="text-muted d-block">{dia.nombre}</small>
                          <strong className="text-primary">
                            {distribucionCalculada[dia.fechaStr] || 0}
                          </strong>
                          <small className="text-muted d-block">{dia.numero}/{(new Date(dia.fecha).getMonth() + 1)}</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="alert alert-light mt-2 mb-0">
                  <small className="text-muted">
                    <strong>Total:</strong> {Object.values(distribucionCalculada).reduce((sum, val) => sum + val, 0)} unidades
                    {tipoDistribucion === 'uniforme' && ' (distribuido uniformemente)'}
                    {tipoDistribucion === 'proporcional' && ' (más material en días centrales)'}
                  </small>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              <i className="fas fa-times me-2"></i>
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleConfirmar}
              disabled={!materialSeleccionado || !cantidadTotal}
            >
              <i className="fas fa-check me-2"></i>
              Confirmar Asignación Semanal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsignarMaterialSemanalModal;