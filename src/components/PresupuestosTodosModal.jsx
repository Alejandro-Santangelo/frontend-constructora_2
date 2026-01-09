import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Alert, Spinner } from 'react-bootstrap';
import PresupuestoDetalleModal from './PresupuestoDetalleModal';

const PresupuestosTodosModal = ({ show, onClose }) => {
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    if (show) {
      setLoading(true);
      setError(null);
      fetch('/api/presupuestos/todos')
        .then(res => {
          if (!res.ok) throw new Error('Error al consultar presupuestos');
          return res.json();
        })
        .then(data => setPresupuestos(data))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [show]);

  return (
    <>
      <Modal show={show} onHide={onClose} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Todos los presupuestos</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando presupuestos...</p>
            </div>
          ) : error ? (
            <Alert variant="danger">{error}</Alert>
          ) : (
            <Alert variant="info">No se encontraron presupuestos o la tabla principal se gestiona desde otro modal.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </Modal.Footer>
      </Modal>
      <PresupuestoDetalleModal
        show={!!detalle}
        onClose={() => setDetalle(null)}
        presupuesto={detalle}
      />
    </>
  );
};

export default PresupuestosTodosModal;
