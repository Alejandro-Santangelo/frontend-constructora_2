import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import './FiltrarPorEstadoResultadosModal.css';

const ProfesionalesAsignadosModal = ({ show, onClose, onBuscar }) => {
  const [presupuestoId, setPresupuestoId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [version, setVersion] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onBuscar({ presupuestoId, empresaId, version });
  };

  return (
    <Modal show={show} onHide={onClose} size="md" centered dialogClassName="modal-dialog-custom">
      <Modal.Header closeButton>
        <Modal.Title>Ver profesionales asignados</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-white border rounded shadow-sm">
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label>ID de presupuesto</label>
            <input type="number" className="form-control" value={presupuestoId} onChange={e => setPresupuestoId(e.target.value)} required placeholder="Ingrese el ID del presupuesto" />
          </div>
          <div className="form-group mb-3">
            <label>ID de empresa</label>
            <input type="number" className="form-control" value={empresaId} onChange={e => setEmpresaId(e.target.value)} required placeholder="Ingrese el ID de la empresa" />
          </div>
          <div className="form-group mb-3">
            <label>Versión (opcional)</label>
            <input type="number" className="form-control" value={version} onChange={e => setVersion(e.target.value)} placeholder="Ingrese la versión (opcional)" />
          </div>
          <Button variant="primary" type="submit" style={{ width: '100%' }}>
            Buscar
          </Button>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default ProfesionalesAsignadosModal;
