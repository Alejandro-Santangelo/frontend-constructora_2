import React, { useState, useEffect } from 'react';
import {
  obtenerReportes,
  descargarArchivo,
  visualizarAuditoria,
  formatearFecha,
  ejecutarAuditoria,
  ejecutarBackup
} from '../services/reportesSistemaService';
import './ReportesSistemaPage.css';

const ReportesSistemaPage = ({ showNotification }) => {
  const [reportes, setReportes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vistaActual, setVistaActual] = useState('auditorias');
  const [ejecutando, setEjecutando] = useState(null); // 'auditoria', 'backup', o null

  useEffect(() => {
    cargarReportes();
  }, []);

  const cargarReportes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerReportes();
      setReportes(data);
      showNotification?.('Reportes cargados correctamente', 'success');
    } catch (err) {
      setError('No se pudieron cargar los reportes. Intente nuevamente.');
      console.error('Error al cargar reportes:', err);
      showNotification?.('Error al cargar reportes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargar = (tipo, nombreArchivo) => {
    try {
      descargarArchivo(tipo, nombreArchivo);
      showNotification?.(`Descargando ${tipo.toLowerCase()}...`, 'info');
    } catch (error) {
      showNotification?.('Error al descargar archivo', 'error');
    }
  };

  const handleVerAuditoria = (nombreArchivo) => {
    try {
      visualizarAuditoria(nombreArchivo);
      showNotification?.('Abriendo auditoría...', 'info');
    } catch (error) {
      showNotification?.('Error al abrir auditoría', 'error');
    }
  };

  const handleEjecutarAuditoria = async () => {
    setEjecutando('auditoria');
    showNotification?.('Ejecutando auditoría de integridad... Esto puede tomar 10-30 segundos.', 'info');
    try {
      const mensaje = await ejecutarAuditoria();
      showNotification?.(mensaje || 'Auditoría ejecutada correctamente. Actualizando lista...', 'success');
      // Recargar lista después de 2 segundos
      setTimeout(() => {
        cargarReportes();
      }, 2000);
    } catch (err) {
      console.error('Error al ejecutar auditoría:', err);

      // Detectar tipo de error para mensaje específico
      let mensajeError = 'Error al ejecutar auditoría. Intente nuevamente.';
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        mensajeError = 'La operación tomó demasiado tiempo. Verifique los reportes manualmente.';
      } else if (err?.message?.includes('Network Error') || err?.message?.includes('red')) {
        mensajeError = 'Error de conexión con el servidor. Verifique que el backend esté activo.';
      }

      showNotification?.(mensajeError, 'error');
    } finally {
      setEjecutando(null);
    }
  };

  const handleEjecutarBackup = async () => {
    setEjecutando('backup');
    showNotification?.('Ejecutando backup de base de datos... Esto puede tomar 10-30 segundos.', 'info');
    try {
      const mensaje = await ejecutarBackup();
      showNotification?.(mensaje || 'Backup ejecutado correctamente. Actualizando lista...', 'success');

      // Recargar lista después de 2 segundos
      setTimeout(() => {
      }, 2000);
    } catch (err) {
      console.error('Error al ejecutar backup:', err);

      // Detectar tipo de error para mensaje específico
      let mensajeError = 'Error al ejecutar backup. Intente nuevamente.';
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        mensajeError = 'La operación tomó demasiado tiempo. Verifique los reportes manualmente.';
      } else if (err?.message?.includes('Network Error') || err?.message?.includes('red')) {
        mensajeError = 'Error de conexión con el servidor. Verifique que el backend esté activo.';
      }

      showNotification?.(mensajeError, 'error');
    } finally {
      setEjecutando(null);
    }
  };

  if (loading) {
    return (
      <div className="reportes-sistema-container">
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando reportes del sistema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reportes-sistema-container">
        <div className="error-container">
          <div className="alert alert-danger" role="alert">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {error}
          </div>
          <button className="btn btn-primary" onClick={cargarReportes}>
            <i className="fas fa-sync-alt me-2"></i>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reportes-sistema-container">
      {/* Header */}
      <div className="reportes-header">
        <div>
          <h1 className="reportes-title">
            <i className="fas fa-shield-alt me-2"></i>
            Controladores del Sistema
          </h1>
          <p className="reportes-subtitle">Monitoreo y respaldo automático</p>
        </div>
        <div className="acciones-header">
          <button
            className="btn btn-auditoria"
            onClick={handleEjecutarAuditoria}
            disabled={ejecutando !== null}
          >
            <i className="fas fa-clipboard-check me-2"></i>
            {ejecutando === 'auditoria' ? 'Ejecutando...' : 'Ejecutar Auditoría Ahora'}
          </button>
          <button
            className="btn btn-backup"
            onClick={handleEjecutarBackup}
            disabled={ejecutando !== null}
          >
            <i className="fas fa-database me-2"></i>
            {ejecutando === 'backup' ? 'Ejecutando...' : 'Ejecutar Backup Ahora'}
          </button>
          <button
            className="btn btn-outline-primary"
            onClick={cargarReportes}
            disabled={ejecutando !== null}
          >
            <i className="fas fa-sync-alt me-2"></i>
            Actualizar Lista
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="resumen-cards">
        <div className="resumen-card card-auditorias">
          <div className="card-icon">
            <i className="fas fa-clipboard-check"></i>
          </div>
          <div className="card-content">
            <h3>Auditorías Disponibles</h3>
            <p className="card-number">{reportes?.totalAuditorias || 0}</p>
            <button
              className="btn-card"
              onClick={() => setVistaActual('auditorias')}
            >
              Ver Detalle
            </button>
          </div>
        </div>

        <div className="resumen-card card-backups">
          <div className="card-icon">
            <i className="fas fa-database"></i>
          </div>
          <div className="card-content">
            <h3>Backups Disponibles</h3>
            <p className="card-number">{reportes?.totalBackups || 0}</p>
            <button
              className="btn-card"
              onClick={() => setVistaActual('backups')}
            >
              Ver Detalle
            </button>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="tabs-container">
        <button
          className={`tab-button ${vistaActual === 'auditorias' ? 'active' : ''}`}
          onClick={() => setVistaActual('auditorias')}
        >
          <i className="fas fa-clipboard-check me-2"></i>
          Auditorías de Integridad
        </button>
        <button
          className={`tab-button ${vistaActual === 'backups' ? 'active' : ''}`}
          onClick={() => setVistaActual('backups')}
        >
          <i className="fas fa-database me-2"></i>
          Backups de Base de Datos
        </button>
      </div>

      {/* Contenido de Auditorías */}
      {vistaActual === 'auditorias' && (
        <div className="seccion-contenido">
          <div className="seccion-info">
            <i className="fas fa-info-circle me-2"></i>
            Reportes semanales que verifican la integridad de los datos del sistema
            (16 categorías verificadas incluyendo: entidades financieras, asignaciones,
            profesionales, trabajos extras, presupuestos y más).
          </div>

          {reportes?.auditorias?.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-inbox"></i>
              <p>No hay auditorías disponibles aún.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>
                      <i className="fas fa-calendar-alt me-2"></i>
                      Fecha y Hora
                    </th>
                    <th>
                      <i className="fas fa-file-alt me-2"></i>
                      Nombre del Archivo
                    </th>
                    <th>
                      <i className="fas fa-hdd me-2"></i>
                      Tamaño
                    </th>
                    <th className="text-center">
                      <i className="fas fa-cog me-2"></i>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportes?.auditorias?.map((auditoria) => (
                    <tr key={auditoria.nombre}>
                      <td>{formatearFecha(auditoria.fechaCreacion)}</td>
                      <td>
                        <code className="filename">{auditoria.nombre}</code>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark">
                          {auditoria.tamanoLegible}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-primary me-2"
                          onClick={() => handleVerAuditoria(auditoria.nombre)}
                          title="Ver reporte en el navegador"
                        >
                          <i className="fas fa-eye"></i>
                          <span className="d-none d-md-inline ms-1">Ver</span>
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleDescargar('AUDITORIA', auditoria.nombre)}
                          title="Descargar archivo HTML"
                        >
                          <i className="fas fa-download"></i>
                          <span className="d-none d-md-inline ms-1">Descargar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contenido de Backups */}
      {vistaActual === 'backups' && (
        <div className="seccion-contenido">
          <div className="seccion-info">
            <i className="fas fa-info-circle me-2"></i>
            Respaldos completos de la base de datos generados semanalmente.
            Incluyen toda la estructura y datos del sistema.
          </div>

          <div className="alert alert-warning">
            <i className="fas fa-exclamation-triangle me-2"></i>
            <strong>Atención:</strong> Los archivos SQL son para uso técnico.
            Contactar al administrador para restauración.
          </div>

          {reportes?.backups?.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-inbox"></i>
              <p>No hay backups disponibles aún.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>
                      <i className="fas fa-calendar-alt me-2"></i>
                      Fecha y Hora
                    </th>
                    <th>
                      <i className="fas fa-file-code me-2"></i>
                      Nombre del Archivo
                    </th>
                    <th>
                      <i className="fas fa-hdd me-2"></i>
                      Tamaño
                    </th>
                    <th className="text-center">
                      <i className="fas fa-cog me-2"></i>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportes?.backups?.map((backup) => (
                    <tr key={backup.nombre}>
                      <td>{formatearFecha(backup.fechaCreacion)}</td>
                      <td>
                        <code className="filename">{backup.nombre}</code>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark">
                          {backup.tamanoLegible}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleDescargar('BACKUP', backup.nombre)}
                          title="Descargar archivo SQL"
                        >
                          <i className="fas fa-download"></i>
                          <span className="d-none d-md-inline ms-1">Descargar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportesSistemaPage;
