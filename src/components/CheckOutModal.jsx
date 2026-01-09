import React, { useState, useEffect } from 'react';
import { 
  registrarCheckOut, 
  obtenerUbicacionActual, 
  obtenerAsistenciaActiva,
  calcularHorasTrabajadas 
} from '../services/asistenciaObraService';
import { useEmpresa } from '../EmpresaContext';

const CheckOutModal = ({ show, onHide, onSuccess, profesionalObraId, profesionalNombre, direccionObra }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [formData, setFormData] = useState({
    horaSalida: new Date().toTimeString().substring(0, 5)
  });
  const [gpsData, setGpsData] = useState(null);
  const [asistenciaActiva, setAsistenciaActiva] = useState(null);
  const [horasTrabajadas, setHorasTrabajadas] = useState(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && profesionalObraId && empresaSeleccionada) {
      // Reset form
      setFormData({
        horaSalida: new Date().toTimeString().substring(0, 5)
      });
      setGpsData(null);
      setError(null);
      setHorasTrabajadas(null);
      
      // Buscar asistencia activa (sin check-out)
      buscarAsistenciaActiva();
      
      // Intentar obtener ubicación automáticamente
      obtenerUbicacion();
    }
  }, [show, profesionalObraId, empresaSeleccionada]);

  // Recalcular horas cuando cambie la hora de salida
  useEffect(() => {
    if (asistenciaActiva && formData.horaSalida) {
      const horas = calcularHorasTrabajadas(asistenciaActiva.horaEntrada, formData.horaSalida);
      setHorasTrabajadas(horas);
    }
  }, [formData.horaSalida, asistenciaActiva]);

  const buscarAsistenciaActiva = async () => {
    setLoadingAsistencia(true);
    setError(null);
    try {
      const activa = await obtenerAsistenciaActiva(
        profesionalObraId,
        new Date().toISOString().split('T')[0],
        empresaSeleccionada.id
      );
      
      if (!activa) {
        setError('No hay un check-in activo para hoy. Debe registrar la entrada primero.');
        setAsistenciaActiva(null);
      } else {
        setAsistenciaActiva(activa);
      }
    } catch (err) {
      console.error('Error buscando asistencia activa:', err);
      setError('No se encontró un check-in activo para hoy. Debe registrar la entrada primero.');
      setAsistenciaActiva(null);
    } finally {
      setLoadingAsistencia(false);
    }
  };

  const obtenerUbicacion = async () => {
    setLoadingGps(true);
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
    if (!asistenciaActiva) {
      setError('No hay un check-in activo para realizar el check-out');
      return;
    }

    if (!gpsData) {
      setError('Debe obtener la ubicación GPS para registrar la salida');
      return;
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    setLoading(true);

    try {
      const checkOutData = {
        horaSalida: formData.horaSalida,
        latitudSalida: gpsData.latitud,
        longitudSalida: gpsData.longitud
      };

      const response = await registrarCheckOut(asistenciaActiva.id, checkOutData, empresaSeleccionada.id);

      // Notificar éxito
      if (onSuccess) {
        onSuccess({
          mensaje: `Check-out registrado exitosamente. Horas trabajadas: ${horasTrabajadas?.total || 'calculando...'}`,
          datos: response
        });
      }

      // Cerrar modal
      onHide();
    } catch (err) {
      console.error('Error registrando check-out:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Error al registrar salida. Por favor intente nuevamente.'
      );
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
            <h5 className="modal-title">🚪 Check-Out - Salida de Obra</h5>
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

            {/* Información de asistencia activa */}
            {loadingAsistencia ? (
              <div className="mb-3 p-3 border rounded text-center">
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Verificando asistencia activa...
              </div>
            ) : asistenciaActiva ? (
              <div className="mb-3 p-3 border rounded bg-success bg-opacity-10">
                <div className="row">
                  <div className="col-md-6">
                    <strong>Fecha:</strong> {asistenciaActiva.fecha}
                  </div>
                  <div className="col-md-6">
                    <strong>Hora de Entrada:</strong>{' '}
                    <span className="badge bg-success">{asistenciaActiva.horaEntrada}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert alert-warning">
                ⚠️ No hay check-in activo para hoy. Debe registrar la entrada primero.
              </div>
            )}

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
              <div className="mb-3">
                <label className="form-label">
                  Hora de Salida <span className="text-danger">*</span>
                </label>
                <input
                  type="time"
                  className="form-control"
                  name="horaSalida"
                  value={formData.horaSalida}
                  onChange={handleChange}
                  required
                  disabled={loading || !asistenciaActiva}
                />
              </div>

              {/* Cálculo de horas trabajadas */}
              {horasTrabajadas && asistenciaActiva && (
                <div className="alert alert-primary">
                  <div className="row text-center">
                    <div className="col-md-4">
                      <strong>Entrada:</strong><br/>
                      <span className="badge bg-success fs-6">{asistenciaActiva.horaEntrada}</span>
                    </div>
                    <div className="col-md-4">
                      <strong>Salida:</strong><br/>
                      <span className="badge bg-danger fs-6">{formData.horaSalida}</span>
                    </div>
                    <div className="col-md-4">
                      <strong>Total:</strong><br/>
                      <span className="badge bg-primary fs-6">{horasTrabajadas.total}</span>
                    </div>
                  </div>
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
              className="btn btn-danger" 
              onClick={handleSubmit} 
              disabled={loading || !gpsData || !asistenciaActiva || loadingGps || loadingAsistencia}
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
                '✓ Registrar Salida'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckOutModal;
