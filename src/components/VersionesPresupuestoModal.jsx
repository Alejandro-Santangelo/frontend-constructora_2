import React, { useState } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVersionesPresupuesto } from '../store/slices/versionesPresupuestoSlice';

const VersionesPresupuestoModal = ({ show, handleClose }) => {
  const dispatch = useDispatch();
  const { versiones, loading, error } = useSelector(state => state.versionesPresupuesto);
  const [idObra, setIdObra] = useState('');
  const [idPresupuesto, setIdPresupuesto] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(fetchVersionesPresupuesto({ idObra, idPresupuesto }));
    setSubmitted(true);
  };

  const handleModalClose = () => {
    setIdObra('');
    setIdPresupuesto('');
    setSubmitted(false);
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleModalClose} centered backdrop="static">
      <Modal.Header closeButton style={{ background: '#fff', borderBottom: '2px solid #007bff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Modal.Title>Obtener todas las versiones de presupuesto</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="idObra">
            <Form.Label>ID de Obra</Form.Label>
            <Form.Control type="text" value={idObra} onChange={e => setIdObra(e.target.value)} required />
          </Form.Group>
          <Form.Group controlId="idPresupuesto" className="mt-3">
            <Form.Label>ID de Presupuesto</Form.Label>
            <Form.Control type="text" value={idPresupuesto} onChange={e => setIdPresupuesto(e.target.value)} required />
          </Form.Group>
          <Button variant="primary" type="submit" className="mt-4" disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Buscar versiones'}
          </Button>
        </Form>
        {submitted && error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {submitted && !loading && versiones.length > 0 && (
          <div className="mt-4">
            <h5>Versiones encontradas:</h5>
            <ul>
              {versiones.map((v, idx) => (
                <li key={idx}>Versión: {v.version} | Estado: {v.estado}</li>
              ))}
            </ul>
          </div>
        )}
        {submitted && !loading && versiones.length === 0 && !error && (
          <Alert variant="info" className="mt-3">No se encontraron versiones.</Alert>
        )}
      </Modal.Body>
      <Modal.Footer style={{ background: '#fff', borderTop: '2px solid #007bff' }}>
        <Button variant="secondary" onClick={handleModalClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default VersionesPresupuestoModal;
