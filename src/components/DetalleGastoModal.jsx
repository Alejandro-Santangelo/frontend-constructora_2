import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner, Card, Row, Col, Badge } from 'react-bootstrap';
import { obtenerDetalleGasto, formatearFechaHora } from '../services/gastosObraService';
import { formatearMoneda } from '../services/cajaChicaService';
import { useEmpresa } from '../EmpresaContext';

const DetalleGastoModal = ({ show, onHide, gastoSeleccionado }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [gasto, setGasto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && gastoSeleccionado && empresaSeleccionada) {
      // Si se pasó el objeto completo, usarlo directamente
      if (gastoSeleccionado.concepto) {
        setGasto(gastoSeleccionado);
      } else if (gastoSeleccionado.id || typeof gastoSeleccionado === 'number') {
        // Si solo se pasó el ID, cargar desde el backend
        cargarDetalle(gastoSeleccionado.id || gastoSeleccionado);
      }
    }
  }, [show, gastoSeleccionado, empresaSeleccionada]);

  const cargarDetalle = async (gastoId) => {
    setLoading(true);
    setError(null);
    try {
      const datos = await obtenerDetalleGasto(gastoId, empresaSeleccionada.id);
      setGasto(datos);
    } catch (err) {
      console.error('Error cargando detalle:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Error al cargar el detalle del gasto. Por favor intente nuevamente.'
      );
      setGasto(null);
    } finally {
      setLoading(false);
    }
  };

  const renderCampo = (label, valor, tipo = 'text') => {
    if (!valor && valor !== 0) {
      return (
        <Row className="mb-2 pb-2 border-bottom">
          <Col md={4}><strong>{label}:</strong></Col>
          <Col md={8}><Badge bg="secondary">No especificado</Badge></Col>
        </Row>
      );
    }

    let valorFormateado = valor;
    
    if (tipo === 'moneda') {
      valorFormateado = <span className="text-danger fs-5">{formatearMoneda(valor)}</span>;
    } else if (tipo === 'fecha') {
      valorFormateado = formatearFechaHora(valor);
    }

    return (
      <Row className="mb-2 pb-2 border-bottom">
        <Col md={4}><strong>{label}:</strong></Col>
        <Col md={8}>{valorFormateado}</Col>
      </Row>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>🔍 Detalle del Gasto</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">Cargando detalle...</p>
          </div>
        ) : !gasto ? (
          <Alert variant="warning">
            No se pudo cargar la información del gasto.
          </Alert>
        ) : (
          <>
            {/* Información principal */}
            <Card className="mb-3">
              <Card.Header className="bg-primary text-white">
                <strong>Información del Gasto</strong>
              </Card.Header>
              <Card.Body>
                {renderCampo('ID Gasto', gasto.id)}
                {renderCampo('Fecha', gasto.fecha, 'fecha')}
                {renderCampo('Monto', gasto.monto, 'moneda')}
                {renderCampo('Concepto/Descripción', gasto.concepto)}
                {renderCampo('Comprobante', gasto.comprobante)}
                {renderCampo('Observaciones', gasto.observaciones)}
              </Card.Body>
            </Card>

            {/* Información del profesional */}
            {(gasto.profesionalNombre || gasto.profesionalObraId) && (
              <Card className="mb-3">
                <Card.Header className="bg-info text-white">
                  <strong>Profesional</strong>
                </Card.Header>
                <Card.Body>
                  {renderCampo('Nombre', gasto.profesionalNombre || 'No disponible')}
                  {renderCampo('ID Asignación', gasto.profesionalObraId)}
                </Card.Body>
              </Card>
            )}

            {/* Información de la obra */}
            {(gasto.direccionObraCalle || gasto.direccionObra) && (
              <Card className="mb-3">
                <Card.Header className="bg-success text-white">
                  <strong>Obra</strong>
                </Card.Header>
                <Card.Body>
                  {gasto.direccionObra ? (
                    renderCampo('Dirección', gasto.direccionObra)
                  ) : (
                    <>
                      {renderCampo('Calle', gasto.direccionObraCalle)}
                      {renderCampo('Altura', gasto.direccionObraAltura)}
                      {renderCampo('Piso', gasto.direccionObraPiso)}
                      {renderCampo('Departamento', gasto.direccionObraDepartamento)}
                    </>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* Auditoría */}
            {(gasto.fechaRegistro || gasto.fechaHora) && (
              <Card>
                <Card.Header className="bg-secondary text-white">
                  <strong>Auditoría</strong>
                </Card.Header>
                <Card.Body>
                  {renderCampo('Fecha de Registro', gasto.fechaRegistro || gasto.fechaHora, 'fecha')}
                  {renderCampo('Usuario', gasto.usuarioRegistro || 'Sistema')}
                </Card.Body>
              </Card>
            )}

            {/* Foto del ticket (si existe) */}
            {gasto.fotoTicket && (
              <Card className="mt-3">
                <Card.Header className="bg-warning">
                  <strong>📸 Comprobante Fotográfico</strong>
                </Card.Header>
                <Card.Body className="text-center">
                  <img 
                    src={gasto.fotoTicket} 
                    alt="Comprobante" 
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                    className="border rounded"
                  />
                </Card.Body>
              </Card>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DetalleGastoModal;
