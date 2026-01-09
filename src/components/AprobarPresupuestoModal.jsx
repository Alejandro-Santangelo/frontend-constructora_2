import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form, Alert, Spinner, Row, Col } from 'react-bootstrap';
import PresupuestoDetalleModal from './PresupuestoDetalleModal';
import apiService from '../services/api';

const AprobarPresupuestoModal = ({ show, onClose, empresas, presupuestos }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestoId, setPresupuestoId] = useState('');
  const [presupuestoIdManual, setPresupuestoIdManual] = useState('');
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    const idFinalEmpresa = empresaSeleccionada ? empresaSeleccionada.id : '';
    const idFinalPresupuesto = presupuestoIdManual.trim() !== '' ? presupuestoIdManual.trim() : presupuestoId;
    
    if (!idFinalEmpresa || !idFinalPresupuesto) {
      setError('Completa todos los campos requeridos.');
      return;
    }
    
    setLoading(true);
    
    try {
      // 🆕 NUEVO FLUJO: Usar el endpoint que crea cliente y obra automáticamente
      // POST /api/presupuestos-no-cliente/{id}/aprobar-crear-obra
      // Soporta clienteReferenciaId (cliente directo) u obraReferenciaId (cliente de obra)
      // Son mutuamente excluyentes
      
      const clienteId = presupuestoSeleccionado?.clienteId || null;
      const obraId = presupuestoSeleccionado?.obraId || null;
      
      const response = await apiService.presupuestosNoCliente.aprobarYCrearObra(
        idFinalPresupuesto,
        clienteId,    // clienteReferenciaId
        obraId        // obraReferenciaId
      );
      
      // Respuesta esperada del backend:
      // {
      //   obraId: number,
      //   presupuestosActualizados: number,
      //   obraCreada: boolean,
      //   clienteReutilizado: boolean,
      //   clienteId: number,
      //   mensaje: "string"
      // }
      
      if (response && response.obraId) {
        setResultado({
          success: true,
          mensaje: response.mensaje || `Presupuesto aprobado exitosamente. Obra creada con ID: ${response.obraId}`,
          obraId: response.obraId,
          presupuestosActualizados: response.presupuestosActualizados,
          obraCreada: response.obraCreada,
          clienteReutilizado: response.clienteReutilizado,
          clienteId: response.clienteId
        });
      } else {
        setError('La aprobación fue procesada pero no se recibió confirmación de la obra creada.');
      }
      
    } catch (err) {
      console.error('Error al aprobar presupuesto:', err);
      
      // Manejo mejorado de errores del backend
      if (err.response?.data) {
        const errorData = err.response.data;
        
        if (typeof errorData === 'string') {
          setError(errorData);
        } else if (errorData.message) {
          setError(errorData.message);
        } else if (errorData.error) {
          setError(errorData.error);
        } else {
          setError('Error al aprobar el presupuesto. Verifique que el presupuesto tenga todos los datos requeridos (dirección de obra completa).');
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Error de red o del servidor al aprobar el presupuesto.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onClose} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Aprobar presupuesto</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Row>
              <Col md={6}>
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
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Presupuesto</Form.Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Form.Select 
                      value={presupuestoId} 
                      onChange={e => {
                        const id = e.target.value;
                        setPresupuestoId(id);
                        // Buscar el presupuesto completo para obtener obraId
                        const presup = presupuestos?.find(p => p.id === parseInt(id));
                        setPresupuestoSeleccionado(presup || null);
                      }} 
                      style={{ flex: 2 }}
                    >
                      <option value="">Seleccionar presupuesto</option>
                      {presupuestos?.map(p => (
                        <option key={p.id} value={p.id}>{p.descripcion || p.id}</option>
                      ))}
                    </Form.Select>
                    <Form.Control 
                      type="text" 
                      placeholder="o ingrese ID" 
                      value={presupuestoIdManual} 
                      onChange={e => {
                        setPresupuestoIdManual(e.target.value);
                        // Si usa ID manual, no tenemos el objeto completo
                        setPresupuestoSeleccionado(null);
                      }} 
                      style={{ flex: 1 }} 
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Versión (opcional)</Form.Label>
                  <Form.Control type="number" value={version} onChange={e => setVersion(e.target.value)} />
                </Form.Group>
              </Col>
            </Row>
            {loading && <div className="text-center py-2"><Spinner animation="border" variant="primary" /></div>}
            
            {resultado && resultado.success && (
              <Alert variant="success" className="mt-3">
                <Alert.Heading>✅ Presupuesto Aprobado</Alert.Heading>
                <p className="mb-2">{resultado.mensaje}</p>
                <hr />
                <div className="mb-0">
                  <strong>Obra ID:</strong> {resultado.obraId}<br />
                  <strong>Obra creada:</strong> {resultado.obraCreada ? 'Sí' : 'No (reutilizada)'}<br />
                  {resultado.clienteId && (
                    <>
                      <strong>Cliente ID:</strong> {resultado.clienteId}<br />
                      <strong>Cliente:</strong> {resultado.clienteReutilizado ? '♻️ Reutilizado de obra existente' : '🆕 Creado nuevo'}<br />
                    </>
                  )}
                  <strong>Presupuestos actualizados:</strong> {resultado.presupuestosActualizados}
                </div>
                {resultado.clienteReutilizado && (
                  <small className="text-success d-block mt-2">
                    ✅ Cliente reutilizado correctamente - Sin duplicados
                  </small>
                )}
                {!resultado.clienteReutilizado && (
                  <small className="text-muted d-block mt-2">
                    ℹ️ Nuevo cliente creado basándose en los datos del solicitante
                  </small>
                )}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={onClose}>
              {resultado ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!resultado && (
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Aprobando...' : 'Aprobar y Crear Obra'}
              </Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default AprobarPresupuestoModal;
