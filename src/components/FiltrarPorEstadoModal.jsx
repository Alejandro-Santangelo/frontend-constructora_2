import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

const estados = [
  'A enviar', 'Enviado', 'En revision', 'Aprobado', 'Rechazado', 'Modificado', 'Activo', 'Vencido', 'Finalizado', 'Cancelado', 'Vigente'
];

const FiltrarPorEstadoModal = ({ show, onClose, empresas, obras, onFiltrar }) => {
  const [empresaId, setEmpresaId] = useState('');
  const [estado, setEstado] = useState('');
  const [obraId, setObraId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onFiltrar({ empresaId, estado, obraId: obraId || null });
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Filtrar presupuestos por estado</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label>Empresa (ID)</label>
            <input
              type="number"
              className="form-control"
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
              required
              placeholder="Ingrese el ID de la empresa"
            />
          </div>
          <div className="form-group mb-3">
            <label>Estado</label>
            <select className="form-control" value={estado} onChange={e => setEstado(e.target.value)} required>
              <option value="">Seleccione estado</option>
              {estados.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-3">
            <label>Obra (opcional)</label>
            <select className="form-control" value={obraId} onChange={e => setObraId(e.target.value)}>
              <option value="">Todas las obras</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </div>
          <Button variant="primary" type="submit" style={{ width: '100%' }}>
            Filtrar
          </Button>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default FiltrarPorEstadoModal;
