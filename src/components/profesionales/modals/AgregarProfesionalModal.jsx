import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

const AgregarProfesionalModal = ({ show, onClose, onSubmit }) => {
  const [showSecondModal, setShowSecondModal] = useState(false);
  const [relaciones, setRelaciones] = useState({});
  const [datos, setDatos] = useState({});

  const handleRelacionesSubmit = () => {
    setShowSecondModal(true);
  };

  const handleDatosSubmit = () => {
    onSubmit({ relaciones, datos });
    onClose();
    setShowSecondModal(false);
  };

  return (
    <>
      <Modal show={show && !showSecondModal} onHide={onClose} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Ingresar relaciones externas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Aquí van los campos de relaciones externas */}
          <Button variant="primary" onClick={handleRelacionesSubmit}>Aceptar</Button>
        </Modal.Body>
      </Modal>
      <Modal show={showSecondModal} onHide={onClose} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Completar datos del profesional</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ marginTop: '60px' }}>
          {/* Aquí van los campos principales del profesional */}
          <div style={{ marginTop: '60px' }}>
            <Button variant="success" onClick={handleDatosSubmit}>Guardar</Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default AgregarProfesionalModal;
