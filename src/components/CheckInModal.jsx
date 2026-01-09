import React, { useState, useEffect } from 'react';
import { registrarCheckIn, obtenerUbicacionActual, obtenerAsistenciaActiva } from '../services/asistenciaObraService';
import { useEmpresa } from '../EmpresaContext';

const CheckInModal = ({ show, onHide, onSuccess, profesionalObraId, profesionalNombre, direccionObra }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    horaEntrada: new Date().toTimeString().substring(0, 5)
  });
  const [gpsData, setGpsData] = useState(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [asistenciaExistente, setAsistenciaExistente] = useState(null);

  useEffect(() => {
    if (show && profesionalObraId && empresaSeleccionada) {
      // Reset form
      const ahora = new Date();
      setFormData({
        fecha: ahora.toISOString().split('T')[0],
        horaEntrada: ahora.toTimeString().substring(0, 5)
      });
      setGpsData(null);
      setError(null);
      setAsistenciaExistente(null);
      
      // Verificar si ya hay asistencia activa
      verificarAsistenciaActiva();
      
      // Intentar obtener ubicación automáticamente
      obtenerUbicacion();
    }
  }, [show, profesionalObraId, empresaSeleccionada]);

  const verificarAsistenciaActiva = async () => {
    try {
      const activa = await obtenerAsistenciaActiva(
        profesionalObraId,
        new Date().toISOString().split('T')[0],
        empresaSeleccionada.id
      );
      if (activa) {
        setAsistenciaExistente(activa);
        setError('Ya existe un check-in activo para hoy. Debe hacer check-out primero.');
      }
    } catch (err) {
      // Si no hay asistencia activa, está bien
      console.log('No hay asistencia activa');
    }
  };

  const obtenerUbicacion = async () => {
    setLoadingGps(true);
    setError(null);
    try {
      const ubicacion = await obtenerUbicacionActual();
      setGpsData(ubicacion);
    } catch (err) {
      console.error('Error obteniendo GPS:', err);
      setError(err.message || 'No se pudo obtener la ubicación GPS');
    } finally {
      setLoadingGps(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!gpsData) {
      setError('Debe obtener la ubicación GPS para registrar la entrada');
      return;
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    if (asistenciaExistente) {
      setError('Ya existe un check-in activo. No se puede registrar una nueva entrada.');
      return;
    }

    setLoading(true);

    try {
      const checkInData = {
        profesionalObraId: profesionalObraId,
        fecha: formData.fecha,
        horaEntrada: formData.horaEntrada,
        latitudEntrada: gpsData.latitud,
        longitudEntrada: gpsData.longitud
      };

      const response = await registrarCheckIn(checkInData, empresaSeleccionada.id);

      // Notificar éxito
      if (onSuccess) {
        onSuccess({
          mensaje: `Check-in registrado exitosamente a las ${formData.horaEntrada}`,
          datos: response
        });
      }

      // Cerrar modal
      onHide();
    } catch (err) {
      console.error('Error registrando check-in:', err);
      
      // Manejar error de asistencia duplicada
      if (err.response?.status === 409 || err.response?.data?.error?.includes('ya existe')) {
        setError('Ya existe un registro de asistencia para esta fecha. Debe hacer check-out primero.');
      } else {
        setError(
          err.response?.data?.message || 
          err.response?.data?.error || 
          'Error al registrar entrada. Por favor intente nuevamente.'
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
            <h5 className="modal-title">📍 Check-In - Entrada a Obra</h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* Información del profesional */}
            <div className="mb-3 p-3 bg-light rounded">
              <div className="row">
                <div className="col-md-6 mb-2">
                  <strong>Profesional:</strong> {profesionalNombre || 'No especificado'}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Obra:</strong> {direccionObra || 'No especificada'}
                </div>
              </div>
            </div>

            {/* Estado GPS */}
            <div className="mb-3 p-3 border rounded">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>📡 Ubicación GPS:</strong>
                <button 
                  type="button"
                  className="btn btn-outline-primary btn-sm" 
                  onClick={obtenerUbicacion}
                  disabled={loadingGps || loading}
                >
                  {loadingGps ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Obteniendo...
                    </>
                  ) : (
                    '🔄 Actualizar GPS'
                  )}
                </button>
              </div>
              
              {loadingGps ? (
                <div className="alert alert-info mb-0">
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Obteniendo ubicación GPS...
                </div>
              ) : gpsData ? (
                <div className="alert alert-success mb-0">
                  <div><strong>✓ Ubicación obtenida</strong></div>
                  <div className="mt-2">
                    <small>
                      <strong>Latitud:</strong> {gpsData.latitud.toFixed(6)}<br/>
                      <strong>Longitud:</strong> {gpsData.longitud.toFixed(6)}<br/>
                      <strong>Precisión:</strong> ±{Math.round(gpsData.precision)}m
                    </small>
                  </div>
                </div>
              ) : (
                <div className="alert alert-warning mb-0">
                  ⚠️ Ubicación GPS no disponible. Haga clic en "Actualizar GPS".
                </div>
              )}
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
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Hora de Entrada <span className="text-danger">*</span>
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      name="horaEntrada"
                      value={formData.horaEntrada}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {asistenciaExistente && (
                <div className="alert alert-warning">
                  <strong>⚠️ Atención:</strong> Ya existe un check-in activo para hoy a las{' '}
                  <span className="badge bg-dark">{asistenciaExistente.horaEntrada}</span>.
                  Debe realizar el check-out antes de registrar una nueva entrada.
                </div>
              )}
            </form>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </button>
            <button 
              type="button"
              className="btn btn-success" 
              onClick={handleSubmit} 
              disabled={loading || !gpsData || loadingGps || asistenciaExistente}
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
                '✓ Registrar Entrada'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckInModal;
