import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form } from 'react-bootstrap';

export const ESTADOS = [
  'BORRADOR', 'A_ENVIAR', 'ENVIADO', 'MODIFICADO', 'APROBADO',
  'OBRA_A_CONFIRMAR', 'EN_EJECUCION', 'SUSPENDIDA', 'TERMINADO', 'CANCELADO'
];


const PresupuestosPorEstadoModal = ({ show, onClose, empresas, obras, onBuscar }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [estado, setEstado] = useState('');
  const [obraId, setObraId] = useState('');
  const [errorEmpresa, setErrorEmpresa] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!empresaSeleccionada) {
      setErrorEmpresa('Debe seleccionar una empresa.');
      return;
    }
    setErrorEmpresa('');
    onBuscar({ empresaId: empresaSeleccionada.id, estado, obraId: obraId || undefined });
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Listar presupuestos por empresa y estado</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Empresa seleccionada</Form.Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 500, fontSize: 15 }}>
                {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || empresaSeleccionada?.razonSocial || empresaSeleccionada?.cuit || empresaSeleccionada?.id || 'Sin empresa'}
              </span>
              <Form.Control
                type="number"
                value={empresaSeleccionada ? empresaSeleccionada.id : ''}
                disabled
                readOnly
                style={{ minWidth: 0, width: 80, fontSize: 13, padding: '2px 6px', textAlign: 'center', background: '#e9ecef' }}
                title="ID de empresa seleccionada"
              />
            </div>
            {errorEmpresa && (
              <div style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{errorEmpresa}</div>
            )}
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Estado</Form.Label>
            <Form.Select value={estado} onChange={e => setEstado(e.target.value)} required>
              <option value="">Seleccionar estado</option>
              {ESTADOS.map(est => (
                <option key={est} value={est}>{est}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Obra (opcional)</Form.Label>
            <Form.Select value={obraId} onChange={e => setObraId(e.target.value)}>
              <option value="">Todas las obras</option>
              {obras?.map(obra => (
                <option key={obra.id} value={obra.id}>{obra.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">Buscar</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default PresupuestosPorEstadoModal;
