import React, { useState } from 'react';

const AsignarOtroCostoSemanalModal = ({ 
  show, 
  onClose, 
  obra, 
  numeroSemana,
  diasSemana = [],
  otrosCostosDisponibles = [],
  onConfirmarAsignacion
}) => {
  const [costoSeleccionado, setCostoSeleccionado] = useState('');
  const [importeTotal, setImporteTotal] = useState('');
  const [tipoDistribucion, setTipoDistribucion] = useState('uniforme'); // 'uniforme' o 'inicio-fin'
  const [observaciones, setObservaciones] = useState('');

  // Calcular distribución automática
  const calcularDistribucion = () => {
    if (!importeTotal || !costoSeleccionado) return {};
    
    const importe = parseFloat(importeTotal);
    const dias = diasSemana.length;
    
    if (tipoDistribucion === 'uniforme') {
      // Distribución uniforme
      const importePorDia = Math.floor(importe * 100 / dias) / 100; // Redondeo a centavos
      const resto = Math.round((importe - (importePorDia * dias)) * 100) / 100;
      
      const distribucion = {};
      diasSemana.forEach((dia, index) => {
        distribucion[dia.fechaStr] = importePorDia + (index === 0 ? resto : 0);
      });
      return distribucion;
    } else {
      // Distribución inicio-fin (más al principio y final de semana)
      const factores = [0.30, 0.15, 0.20, 0.15, 0.20]; // L, M, X, J, V
      const distribucion = {};
      diasSemana.forEach((dia, index) => {
        const factor = factores[index] || 0.2;
        distribucion[dia.fechaStr] = Math.round(importe * factor * 100) / 100;
      });
      return distribucion;
    }
  };

  const distribucionCalculada = calcularDistribucion();

  const handleConfirmar = () => {
    if (!costoSeleccionado || !importeTotal) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    const costo = otrosCostosDisponibles.find(c => c.id === costoSeleccionado);
    
    const asignacionesSemana = diasSemana.map(dia => ({
      otroCostoId: costoSeleccionado,
      nombreOtroCosto: costo.nombre,
      importe: distribucionCalculada[dia.fechaStr] || 0,
      fechaAsignacion: dia.fechaStr,
      numeroSemana: numeroSemana, // 🔥 NUEVO: incluir número de semana
      observaciones: observaciones + ` (Semana ${numeroSemana} - ${tipoDistribucion})`
    })).filter(a => a.importe > 0);

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
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="fas fa-calendar-week me-2"></i>
              Asignar Otros Costos para Toda la Semana {numeroSemana}
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
              Configure la asignación para toda la semana. El costo se distribuirá automáticamente 
              entre los {diasSemana.length} días hábiles según el tipo de distribución seleccionado.
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Otro Costo *</label>
                <select 
                  className="form-select"
                  value={costoSeleccionado}
                  onChange={(e) => setCostoSeleccionado(e.target.value)}
                >
                  <option value="">Seleccione un costo...</option>
                  {otrosCostosDisponibles.map(costo => (
                    <option key={costo.id} value={costo.id}>
                      {costo.nombre} - ${costo.importe}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Importe Total *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="$ Importe total"
                  step="0.01"
                  min="0"
                  value={importeTotal}
                  onChange={(e) => setImporteTotal(e.target.value)}
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
                  <option value="inicio-fin">Inicio-Fin</option>
                </select>
              </div>

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
            {importeTotal && costoSeleccionado && (
              <div className="mt-4">
                <h6 className="text-success">
                  <i className="fas fa-eye me-2"></i>
                  Vista previa de distribución:
                </h6>
                <div className="row">
                  {diasSemana.map((dia, index) => (
                    <div key={index} className="col">
                      <div className="card text-center">
                        <div className="card-body py-2">
                          <small className="text-muted d-block">{dia.nombre}</small>
                          <strong className="text-success">
                            ${(distribucionCalculada[dia.fechaStr] || 0).toFixed(2)}
                          </strong>
                          <small className="text-muted d-block">{dia.numero}/{(new Date(dia.fecha).getMonth() + 1)}</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="alert alert-light mt-2 mb-0">
                  <small className="text-muted">
                    <strong>Total:</strong> ${Object.values(distribucionCalculada).reduce((sum, val) => sum + val, 0).toFixed(2)}
                    {tipoDistribucion === 'uniforme' && ' (distribuido uniformemente)'}
                    {tipoDistribucion === 'inicio-fin' && ' (más al principio y final de semana)'}
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
              className="btn btn-success"
              onClick={handleConfirmar}
              disabled={!costoSeleccionado || !importeTotal}
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

export default AsignarOtroCostoSemanalModal;