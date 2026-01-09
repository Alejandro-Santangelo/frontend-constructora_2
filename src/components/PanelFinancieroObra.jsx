import React, { useState } from 'react';
import RegistrarNuevoCobroModal from './RegistrarNuevoCobroModal';
import ListarCobrosObraModal from './ListarCobrosObraModal';
import RegistrarPagoProfesionalModal from './RegistrarPagoProfesionalModal';
import ListarPagosProfesionalModal from './ListarPagosProfesionalModal';
import ResumenFinancieroObraModal from './ResumenFinancieroObraModal';
import NotificationToast from './NotificationToast';

/**
 * Panel de gestión financiera de obras
 * Ejemplo de integración de todos los modales del sistema financiero
 */
const PanelFinancieroObra = ({ obraId, obraDireccion }) => {
  // Estados para controlar modales
  const [showRegistrarCobro, setShowRegistrarCobro] = useState(false);
  const [showListarCobros, setShowListarCobros] = useState(false);
  const [showRegistrarPago, setShowRegistrarPago] = useState(false);
  const [showListarPagos, setShowListarPagos] = useState(false);
  const [showResumenFinanciero, setShowResumenFinanciero] = useState(false);

  // Estado para notificaciones
  const [notification, setNotification] = useState(null);
  
  // Estado para forzar actualización del resumen financiero
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSuccess = (data) => {
    setNotification({
      type: 'success',
      message: data.mensaje
    });
    
    // Forzar actualización del resumen financiero
    setRefreshTrigger(prev => prev + 1);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="panel-financiero-obra">
      {/* Notificaciones */}
      {notification && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Título */}
      <div className="mb-4">
        <h3>💰 Pagos - Cobros</h3>
        {obraDireccion && (
          <p className="text-muted mb-0">Obra: {obraDireccion}</p>
        )}
      </div>

      {/* Botones principales */}
      <div className="row g-3 mb-4">
        {/* COBROS */}
        <div className="col-md-6">
          <div className="card border-success shadow-sm">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">💰 Cobros de Obra</h5>
            </div>
            <div className="card-body">
              <p className="card-text">
                Registre cobros de obra, anticipo, certificados y gestione los pagos del cliente.
              </p>
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-success"
                  onClick={() => setShowRegistrarCobro(true)}
                >
                  ➕ Registrar Nuevo Cobro
                </button>
                <button 
                  className="btn btn-outline-success"
                  onClick={() => setShowListarCobros(true)}
                >
                  📋 Ver Todos los Cobros
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PAGOS */}
        <div className="col-md-6">
          <div className="card border-primary shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">💸 Pagos a Profesionales</h5>
            </div>
            <div className="card-body">
              <p className="card-text">
                Registre pagos semanales, adelantos y gestione los sueldos de profesionales.
              </p>
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowRegistrarPago(true)}
                >
                  ➕ Registrar Nuevo Pago
                </button>
                <button 
                  className="btn btn-outline-primary"
                  onClick={() => setShowListarPagos(true)}
                >
                  📋 Ver Todos los Pagos
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Financiero */}
      <div className="row">
        <div className="col-12">
          <div className="card border-info shadow-sm">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">📊 Pagos - Cobros</h5>
            </div>
            <div className="card-body text-center">
              <p className="card-text mb-3">
                Visualice el resumen completo: ingresos, egresos, balance, estadísticas y alertas.
              </p>
              <button 
                className="btn btn-info btn-lg"
                onClick={() => setShowResumenFinanciero(true)}
              >
                📈 Ver Dashboard Completo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modales de Cobros */}
      <RegistrarNuevoCobroModal
        show={showRegistrarCobro}
        onHide={() => setShowRegistrarCobro(false)}
        onSuccess={handleSuccess}
        obraId={obraId}
        obraDireccion={obraDireccion}
      />

      <ListarCobrosObraModal
        show={showListarCobros}
        onHide={() => setShowListarCobros(false)}
        onSuccess={handleSuccess}
        obraId={obraId}
        obraDireccion={obraDireccion}
      />

      {/* Modales de Pagos */}
      <RegistrarPagoProfesionalModal
        show={showRegistrarPago}
        onHide={() => setShowRegistrarPago(false)}
        onSuccess={handleSuccess}
        obraId={obraId}
      />

      <ListarPagosProfesionalModal
        show={showListarPagos}
        onHide={() => setShowListarPagos(false)}
        onSuccess={handleSuccess}
        obraId={obraId}
      />

      {/* Modal Dashboard */}
      <ResumenFinancieroObraModal
        show={showResumenFinanciero}
        onHide={() => setShowResumenFinanciero(false)}
        obraId={obraId}
        obraDireccion={obraDireccion}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default PanelFinancieroObra;
