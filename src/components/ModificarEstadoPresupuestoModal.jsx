import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { ESTADOS } from './PresupuestosPorEstadoModal';
import PresupuestoDetalleModal from './PresupuestoDetalleModal';

const ModificarEstadoPresupuestoModal = ({ show, onClose, empresas, obras }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [obraId, setObraId] = useState('');
  const [obraIdManual, setObraIdManual] = useState('');
  const [version, setVersion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
  const idFinalEmpresa = empresaSeleccionada ? empresaSeleccionada.id : '';
    const idFinalObra = obraIdManual.trim() !== '' ? obraIdManual.trim() : obraId;
    if (!idFinalEmpresa || !idFinalObra || !version || !nuevoEstado) {
      setError('Completa todos los campos requeridos.');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        empresaId: idFinalEmpresa,
        obraId: idFinalObra,
        version,
        nuevoEstado
      });
      const res = await fetch(`/api/presupuestos/modificar-estado?${params.toString()}`, {
        method: 'PUT',
        headers: { 'accept': '*/*' }
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || 'Error al modificar el estado.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResultado(data);
    } catch (err) {
      setError('Error de red o del servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Modificar estado de presupuesto</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
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
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Obra</Form.Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Form.Select value={obraId} onChange={e => setObraId(e.target.value)} style={{ flex: 2 }}>
                  <option value="">Seleccionar obra</option>
                  {obras?.map(obra => (
                    <option key={obra.id} value={obra.id}>{obra.nombre || obra.id}</option>
                  ))}
                </Form.Select>
                <Form.Control
                  type="text"
                  placeholder="o ingrese ID"
                  value={obraIdManual}
                  onChange={e => setObraIdManual(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Versión</Form.Label>
              <Form.Control type="number" value={version} onChange={e => setVersion(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nuevo estado</Form.Label>
              <Form.Select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)} required>
                <option value="">Seleccionar estado</option>
                {ESTADOS.map(est => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </Form.Select>
            </Form.Group>
            {loading && <div className="text-center py-2"><Spinner animation="border" variant="primary" /></div>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Modificar estado</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <PresupuestoDetalleModal
        show={!!resultado}
        onClose={() => setResultado(null)}
        presupuesto={resultado}
      />
    </>
  );
};

export default ModificarEstadoPresupuestoModal;
