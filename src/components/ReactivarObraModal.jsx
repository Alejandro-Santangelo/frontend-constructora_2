import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

const ReactivarObraModal = ({ show, onClose, obra, onSuccess }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestosDisponibles, setPresupuestosDisponibles] = useState([]);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false);
  const [error, setError] = useState('');

  // Cargar presupuestos APROBADOS disponibles
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarPresupuestosDisponibles();
    }
  }, [show, empresaSeleccionada]);

  const cargarPresupuestosDisponibles = async () => {
    setLoadingPresupuestos(true);
    setError('');
    try {
      const empresaId = empresaSeleccionada.id;
      
      // Obtener todos los presupuestos de la empresa
      const presupuestos = await api.presupuestosNoCliente.getAll(empresaId);
      
      // Filtrar solo los APROBADOS y sin obra vinculada
      const disponibles = presupuestos.filter(p => 
        p.estado === 'APROBADO' && 
        (p.obraId === null || p.obraId === undefined)
      );
      
      setPresupuestosDisponibles(disponibles);
      
      if (disponibles.length === 0) {
        setError('No hay presupuestos aprobados disponibles para vincular. Crea y aprueba un presupuesto primero.');
      }
    } catch (err) {
      console.error('Error al cargar presupuestos:', err);
      setError('Error al cargar presupuestos disponibles');
    } finally {
      setLoadingPresupuestos(false);
    }
  };

  const handleReactivar = async () => {
    if (!presupuestoSeleccionado) {
      setError('Debes seleccionar un presupuesto');
      return;
    }

    // Confirmación adicional
    const confirmar = window.confirm(
      `¿Estás seguro de reactivar esta obra con el presupuesto seleccionado?\n\n` +
      `Obra: ${obra.nombre}\n` +
      `Estado actual: ${obra.estado}\n` +
      `Presupuesto a vincular: ID ${presupuestoSeleccionado}`
    );

    if (!confirmar) return;

    setLoading(true);
    setError('');

    try {
      const empresaId = empresaSeleccionada.id;
      const response = await api.presupuestosNoCliente.reactivarObra(
        obra.id,
        presupuestoSeleccionado,
        empresaId
      );

      // Llamar callback de éxito con los datos de la respuesta
      if (onSuccess) {
        onSuccess(response);
      }

      // Cerrar modal
      onClose();
    } catch (err) {
      console.error('Error al reactivar obra:', err);
      
      // Manejar diferentes tipos de error
      let mensajeError = 'Error al reactivar la obra';
      
      if (err.response?.data?.mensaje) {
        mensajeError = err.response.data.mensaje;
      } else if (err.message) {
        mensajeError = err.message;
      }

      // Mapear códigos de estado a mensajes específicos
      if (err.response?.status === 403) {
        mensajeError = 'No tienes permisos para esta operación';
      } else if (err.response?.status === 404) {
        mensajeError = 'Obra o presupuesto no encontrado';
      } else if (err.response?.status === 500) {
        mensajeError = 'Error del servidor. Intenta nuevamente';
      }

      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPresupuestoSeleccionado('');
      setError('');
      onClose();
    }
  };

  const formatearMoneda = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(monto || 0);
  };

  const presupuestoAnterior = obra?.presupuestoNoClienteId 
    ? { id: obra.presupuestoNoClienteId, total: obra.presupuestoEstimado }
    : null;

  const presupuestoSeleccionadoData = presupuestosDisponibles.find(
    p => p.id === parseInt(presupuestoSeleccionado)
  );

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-play-circle me-2 text-warning"></i>
          Reactivar Obra
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Información de la obra */}
        <div className="mb-4 p-3 bg-light rounded">
          <h5 className="mb-3">{obra?.nombre || 'Sin nombre'}</h5>
          <div className="row">
            <div className="col-md-6">
              <p className="mb-1">
                <strong>Estado actual:</strong>{' '}
                <span className={`badge ${
                  obra?.estado === 'SUSPENDIDA' ? 'bg-secondary' : 'bg-danger'
                }`}>
                  {obra?.estado}
                </span>
              </p>
            </div>
            <div className="col-md-6">
              <p className="mb-1">
                <strong>Dirección:</strong> {obra?.direccion || 'Sin dirección'}
              </p>
            </div>
          </div>
        </div>

        {/* Descripción */}
        <Alert variant="info" className="mb-3">
          <i className="fas fa-info-circle me-2"></i>
          Esta obra está <strong>{obra?.estado}</strong>. Para reactivarla, selecciona un presupuesto 
          <strong> APROBADO</strong> para vincular.
        </Alert>

        {/* Presupuesto anterior */}
        {presupuestoAnterior && (
          <Alert variant="warning" className="mb-3">
            <i className="fas fa-exclamation-triangle me-2"></i>
            <strong>Advertencia:</strong> El presupuesto anterior (ID: {presupuestoAnterior.id} - {formatearMoneda(presupuestoAnterior.total)}) 
            será desvinculado de esta obra.
          </Alert>
        )}

        {/* Error general */}
        {error && (
          <Alert variant="danger" className="mb-3">
            <i className="fas fa-exclamation-circle me-2"></i>
            {error}
          </Alert>
        )}

        {/* Selector de presupuesto */}
        <Form.Group className="mb-3">
          <Form.Label>
            <strong>Seleccionar presupuesto aprobado:</strong>
          </Form.Label>
          
          {loadingPresupuestos ? (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" className="me-2" />
              Cargando presupuestos disponibles...
            </div>
          ) : (
            <Form.Select 
              value={presupuestoSeleccionado}
              onChange={(e) => setPresupuestoSeleccionado(e.target.value)}
              disabled={loading || presupuestosDisponibles.length === 0}
              size="lg"
            >
              <option value="">-- Selecciona un presupuesto --</option>
              {presupuestosDisponibles.map(p => (
                <option key={p.id} value={p.id}>
                  Presupuesto #{p.numeroPresupuesto || p.id} - 
                  {p.descripcion ? ` ${p.descripcion} - ` : ' '}
                  {formatearMoneda(p.montoTotal || p.totalPresupuestoConHonorarios)} - 
                  Aprobado
                  {p.fechaEmision ? ` - ${new Date(p.fechaEmision).toLocaleDateString()}` : ''}
                </option>
              ))}
            </Form.Select>
          )}
        </Form.Group>

        {/* Información del presupuesto seleccionado */}
        {presupuestoSeleccionadoData && (
          <div className="p-3 bg-success bg-opacity-10 border border-success rounded">
            <h6 className="text-success mb-2">
              <i className="fas fa-check-circle me-2"></i>
              Presupuesto seleccionado:
            </h6>
            <div className="row">
              <div className="col-md-6">
                <p className="mb-1"><strong>ID:</strong> {presupuestoSeleccionadoData.id}</p>
                <p className="mb-1"><strong>Número:</strong> #{presupuestoSeleccionadoData.numeroPresupuesto || presupuestoSeleccionadoData.id}</p>
              </div>
              <div className="col-md-6">
                <p className="mb-1">
                  <strong>Total:</strong>{' '}
                  <span className="text-success fw-bold">
                    {formatearMoneda(presupuestoSeleccionadoData.montoTotal || presupuestoSeleccionadoData.totalPresupuestoConHonorarios)}
                  </span>
                </p>
                <p className="mb-1"><strong>Versión:</strong> {presupuestoSeleccionadoData.numeroVersion || 1}</p>
              </div>
            </div>
            {presupuestoSeleccionadoData.descripcion && (
              <p className="mb-0 mt-2">
                <strong>Descripción:</strong> {presupuestoSeleccionadoData.descripcion}
              </p>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={handleClose}
          disabled={loading}
        >
          <i className="fas fa-times me-2"></i>
          Cancelar
        </Button>
        <Button 
          variant="warning" 
          onClick={handleReactivar}
          disabled={loading || !presupuestoSeleccionado || presupuestosDisponibles.length === 0}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Reactivando...
            </>
          ) : (
            <>
              <i className="fas fa-play-circle me-2"></i>
              Reactivar Obra
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ReactivarObraModal;
