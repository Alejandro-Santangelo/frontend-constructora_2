import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

const EditarProfesionalModal = ({ show, onClose, profesional, onSubmit }) => {
  const [showSecondModal, setShowSecondModal] = useState(false);
  const [relaciones, setRelaciones] = useState({});
  const [datos, setDatos] = useState(profesional || {});

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
          <Modal.Title>Editar relaciones externas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Aquí van los campos de relaciones externas */}
          <Button variant="primary" onClick={handleRelacionesSubmit}>Aceptar</Button>
        </Modal.Body>
      </Modal>
      <Modal show={showSecondModal} onHide={onClose} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Modificar datos del profesional</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Aquí van los campos principales del profesional */}
          <Button variant="success" onClick={handleDatosSubmit}>Guardar cambios</Button>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default EditarProfesionalModal;
