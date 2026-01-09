import React, { useState, useEffect } from 'react';
import { registrarGasto } from '../services/gastosObraService';
import { consultarSaldoCajaChica, formatearMoneda } from '../services/cajaChicaService';
import { useEmpresa } from '../EmpresaContext';

const RegistrarGastoModal = ({ show, onHide, onSuccess, profesionalObraId, profesionalNombre, direccionObra }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    monto: '',
    comprobante: '',
    observaciones: ''
  });
  const [saldoDisponible, setSaldoDisponible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && profesionalObraId && empresaSeleccionada) {
      cargarSaldo();
      // Reset form
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        concepto: '',
        monto: '',
        comprobante: '',
        observaciones: ''
      });
      setError(null);
    }
  }, [show, profesionalObraId, empresaSeleccionada]);

  const cargarSaldo = async () => {
    setLoadingSaldo(true);
    try {
      const datos = await consultarSaldoCajaChica(profesionalObraId, empresaSeleccionada.id);
      setSaldoDisponible(datos.saldoActual || 0);
    } catch (err) {
      console.error('Error cargando saldo:', err);
      setSaldoDisponible(null);
    } finally {
      setLoadingSaldo(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validarSaldo = () => {
    if (saldoDisponible === null) return true; // No validar si no se pudo cargar
    const montoGasto = parseFloat(formData.monto) || 0;
    return montoGasto <= saldoDisponible;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!formData.concepto.trim()) {
      setError('El concepto es obligatorio');
      return;
    }

    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      setError('Debe ingresar un monto mayor a 0');
      return;
    }

    if (!validarSaldo()) {
      setError(`Saldo insuficiente. Disponible: ${formatearMoneda(saldoDisponible)}`);
      return;
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    setLoading(true);

    try {
      const gastoData = {
        profesionalObraId: profesionalObraId,
        fecha: formData.fecha,
        concepto: formData.concepto,
        monto: parseFloat(formData.monto),
        comprobante: formData.comprobante || null,
        observaciones: formData.observaciones || null
      };

      const response = await registrarGasto(gastoData, empresaSeleccionada.id);

      // Notificar éxito
      if (onSuccess) {
        onSuccess({
          mensaje: `Gasto registrado exitosamente: ${formatearMoneda(parseFloat(formData.monto))}`,
          datos: response
        });
      }

      // Cerrar modal
      onHide();
    } catch (err) {
      console.error('Error registrando gasto:', err);
      
      // Manejar error específico de saldo insuficiente
      if (err.response?.status === 400 && err.response?.data?.error?.includes('Saldo insuficiente')) {
        setError(`${err.response.data.error}. Disponible: ${formatearMoneda(err.response.data.saldoActual || 0)}`);
      } else {
        setError(
          err.response?.data?.message || 
          err.response?.data?.error || 
          'Error al registrar gasto. Por favor intente nuevamente.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog modal-lg" style={{marginTop: '120px', maxWidth: '800px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">🛒 Registrar Gasto de Obra</h5>
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

            {/* Información del profesional y saldo */}
            <div className="mb-3 p-3 bg-light rounded">
              <div className="row">
                <div className="col-md-6 mb-2">
                  <strong>Profesional:</strong> {profesionalNombre || 'No especificado'}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Obra:</strong> {direccionObra || 'No especificada'}
                </div>
              </div>
              <div className="mt-2 pt-2 border-top">
                <strong>Saldo Disponible: </strong>
                {loadingSaldo ? (
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                ) : (
                  <span className={`fs-5 ${saldoDisponible && saldoDisponible > 0 ? 'text-success' : 'text-danger'}`}>
                    {saldoDisponible !== null ? formatearMoneda(saldoDisponible) : 'No disponible'}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Fecha <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      name="fecha"
                      value={formData.fecha}
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      required
                      disabled={loading}
                      style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Monto <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      name="monto"
                      placeholder="Ej: 5000"
                      value={formData.monto}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      required
                      disabled={loading}
                      style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                    />
                    {formData.monto && parseFloat(formData.monto) > 0 && (
                      <div className={`form-text ${validarSaldo() ? 'text-success' : 'text-danger'}`}>
                        {formatearMoneda(parseFloat(formData.monto))}
                        {!validarSaldo() && ' - ⚠️ Excede el saldo disponible'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Concepto/Descripción <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  name="concepto"
                  placeholder="Ej: Compra de materiales - cemento y arena"
                  value={formData.concepto}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Comprobante</label>
                <input
                  type="text"
                  className="form-control"
                  name="comprobante"
                  placeholder="Ej: FC-001-00123456"
                  value={formData.comprobante}
                  onChange={handleChange}
                  disabled={loading}
                  style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                />
                <div className="form-text text-muted">
                  Número de factura, recibo u otro comprobante
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Observaciones</label>
                <textarea
                  className="form-control"
                  rows={2}
                  name="observaciones"
                  placeholder="Observaciones adicionales (opcional)"
                  value={formData.observaciones}
                  onChange={handleChange}
                  disabled={loading}
                  style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                />
              </div>
            </form>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </button>
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={handleSubmit} 
              disabled={loading || !formData.concepto || !formData.monto || parseFloat(formData.monto) <= 0 || !validarSaldo()}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Registrando...
                </>
              ) : (
                '✓ Registrar Gasto'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarGastoModal;
