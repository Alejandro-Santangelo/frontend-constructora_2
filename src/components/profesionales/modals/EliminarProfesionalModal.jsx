import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const EliminarProfesionalModal = ({ show, onClose, profesional, onSubmit }) => {
  return (
    <Modal show={show} onHide={onClose} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Eliminar profesional</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        ¿Está seguro que desea eliminar a {profesional?.nombre || 'este profesional'}?
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={() => { onSubmit(profesional); onClose(); }}>Eliminar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EliminarProfesionalModal;
