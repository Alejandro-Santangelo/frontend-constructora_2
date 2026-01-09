import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form, Row, Col, Table, Spinner, Alert } from 'react-bootstrap';
import { ESTADOS } from './PresupuestosPorEstadoModal';
import PresupuestoDetalleModal from './PresupuestoDetalleModal';

const emptyProfesional = {
  tipo: '', horas: '', dias: '', semanas: '', meses: '', honorarioHora: '', honorarioDia: '', honorarioSemana: '', honorarioMes: ''
};
const emptyMaterial = {
  nombre: '', cantidad: '', unidadMedida: '', precioUnitario: '', observaciones: ''
};
const emptyOtroCosto = {
  monto: '', descripcion: '', observaciones: '', fecha: ''
};

const NuevaVersionPresupuestoModal = ({ show, onClose, empresas, obras }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [obraId, setObraId] = useState('');
  const [obraIdManual, setObraIdManual] = useState('');
  const [form, setForm] = useState({
    fechaEmision: '', fechaValidez: '', version: '', fechaCreacion: '', fechaModificacion: '', estado: '', numero: '', descripcion: '', observaciones: '',
    honorarioDireccionObra: { valorFijo: '', porcentaje: '' },
    profesionales: [], materiales: [], otrosCostos: []
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Handlers para arrays
  const handleArrayChange = (arr, idx, field, value) => {
    setForm(f => ({ ...f, [arr]: f[arr].map((item, i) => i === idx ? { ...item, [field]: value } : item) }));
  };
  const handleAddArray = arr => setForm(f => ({ ...f, [arr]: [...f[arr], arr === 'profesionales' ? { ...emptyProfesional } : arr === 'materiales' ? { ...emptyMaterial } : { ...emptyOtroCosto }] }));
  const handleRemoveArray = (arr, idx) => setForm(f => ({ ...f, [arr]: f[arr].filter((_, i) => i !== idx) }));

  const handleHonorarioChange = (field, value) => {
    setForm(f => ({ ...f, honorarioDireccionObra: { ...f.honorarioDireccionObra, [field]: value } }));
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setResultado(null);
  const idFinalEmpresa = empresaSeleccionada ? empresaSeleccionada.id : '';
    const idFinalObra = obraIdManual.trim() !== '' ? obraIdManual.trim() : obraId;
    if (!idFinalEmpresa || !idFinalObra) {
      setError('Completa empresa y obra.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/presupuestos/nueva-version?empresaId=${idFinalEmpresa}&idObra=${idFinalObra}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || 'Error al crear nueva versión.');
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

  // Modal de detalle reutilizado para mostrar la respuesta completa
  return (
    <>
      <Modal show={show} onHide={onClose} size="xl" centered backdrop="static" dialogClassName="modal-nueva-version" style={{ minWidth: '90vw', maxWidth: '98vw' }}>
        <Modal.Header closeButton>
          <Modal.Title>Crear nueva versión de presupuesto</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto', background: '#f8f9fa' }}>
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
                  <Form.Label>Obra</Form.Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Form.Select value={obraId} onChange={e => setObraId(e.target.value)} style={{ flex: 2 }}>
                      <option value="">Seleccionar obra</option>
                      {obras?.map(obra => (
                        <option key={obra.id} value={obra.id}>{obra.nombre || obra.id}</option>
                      ))}
                    </Form.Select>
                    <Form.Control type="text" placeholder="o ingrese ID" value={obraIdManual} onChange={e => setObraIdManual(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha emisión</Form.Label>
                  <Form.Control type="date" name="fechaEmision" value={form.fechaEmision} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha validez</Form.Label>
                  <Form.Control type="date" name="fechaValidez" value={form.fechaValidez} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha creación</Form.Label>
                  <Form.Control type="datetime-local" name="fechaCreacion" value={form.fechaCreacion} onChange={handleChange} />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha modificación</Form.Label>
                  <Form.Control type="datetime-local" name="fechaModificacion" value={form.fechaModificacion} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Estado</Form.Label>
                  <Form.Select name="estado" value={form.estado} onChange={handleChange} required>
                    <option value="">Seleccionar estado</option>
                    {ESTADOS.map(est => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group className="mb-3">
                  <Form.Label>Versión</Form.Label>
                  <Form.Control type="number" name="version" value={form.version} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group className="mb-3">
                  <Form.Label>Número</Form.Label>
                  <Form.Control type="text" name="numero" value={form.numero} onChange={handleChange} />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Descripción</Form.Label>
                  <Form.Control type="text" name="descripcion" value={form.descripcion} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Observaciones</Form.Label>
                  <Form.Control type="text" name="observaciones" value={form.observaciones} onChange={handleChange} />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Honorario dirección de obra</Form.Label>
                  <Row>
                    <Col md={6}><Form.Control type="number" placeholder="Valor fijo" value={form.honorarioDireccionObra.valorFijo} onChange={e => handleHonorarioChange('valorFijo', e.target.value)} /></Col>
                    <Col md={6}><Form.Control type="number" placeholder="Porcentaje" value={form.honorarioDireccionObra.porcentaje} onChange={e => handleHonorarioChange('porcentaje', e.target.value)} /></Col>
                  </Row>
                </Form.Group>
              </Col>
            </Row>
            {/* Profesionales */}
            <div className="mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              <h5 className="mb-0 me-2">Profesionales</h5>
              <Button variant="outline-primary" size="sm" onClick={() => handleAddArray('profesionales')}>Agregar profesional</Button>
            </div>
            <Table bordered size="sm">
              <thead>
                <tr>
                  <th>Tipo</th><th>Horas</th><th>Días</th><th>Semanas</th><th>Meses</th><th>Honorario Hora</th><th>Honorario Día</th><th>Honorario Semana</th><th>Honorario Mes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {form.profesionales.map((prof, idx) => (
                  <tr key={idx}>
                    <td><Form.Control value={prof.tipo} onChange={e => handleArrayChange('profesionales', idx, 'tipo', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.horas} onChange={e => handleArrayChange('profesionales', idx, 'horas', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.dias} onChange={e => handleArrayChange('profesionales', idx, 'dias', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.semanas} onChange={e => handleArrayChange('profesionales', idx, 'semanas', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.meses} onChange={e => handleArrayChange('profesionales', idx, 'meses', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.honorarioHora} onChange={e => handleArrayChange('profesionales', idx, 'honorarioHora', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.honorarioDia} onChange={e => handleArrayChange('profesionales', idx, 'honorarioDia', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.honorarioSemana} onChange={e => handleArrayChange('profesionales', idx, 'honorarioSemana', e.target.value)} /></td>
                    <td><Form.Control type="number" value={prof.honorarioMes} onChange={e => handleArrayChange('profesionales', idx, 'honorarioMes', e.target.value)} /></td>
                    <td><Button variant="danger" size="sm" onClick={() => handleRemoveArray('profesionales', idx)}>-</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {/* Materiales */}
            <div className="mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              <h5 className="mb-0 me-2">Materiales</h5>
              <Button variant="outline-primary" size="sm" onClick={() => handleAddArray('materiales')}>Agregar material</Button>
            </div>
            <Table bordered size="sm">
              <thead>
                <tr>
                  <th>Nombre</th><th>Cantidad</th><th>Unidad</th><th>Precio Unitario</th><th>Observaciones</th><th></th>
                </tr>
              </thead>
              <tbody>
                {form.materiales.map((mat, idx) => (
                  <tr key={idx}>
                    <td><Form.Control value={mat.nombre} onChange={e => handleArrayChange('materiales', idx, 'nombre', e.target.value)} /></td>
                    <td><Form.Control type="number" value={mat.cantidad} onChange={e => handleArrayChange('materiales', idx, 'cantidad', e.target.value)} /></td>
                    <td><Form.Control value={mat.unidadMedida} onChange={e => handleArrayChange('materiales', idx, 'unidadMedida', e.target.value)} /></td>
                    <td><Form.Control type="number" value={mat.precioUnitario} onChange={e => handleArrayChange('materiales', idx, 'precioUnitario', e.target.value)} /></td>
                    <td><Form.Control value={mat.observaciones} onChange={e => handleArrayChange('materiales', idx, 'observaciones', e.target.value)} /></td>
                    <td><Button variant="danger" size="sm" onClick={() => handleRemoveArray('materiales', idx)}>-</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {/* Otros Costos */}
            <div className="mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              <h5 className="mb-0 me-2">Otros Costos</h5>
              <Button variant="outline-primary" size="sm" onClick={() => handleAddArray('otrosCostos')}>Agregar otro costo</Button>
            </div>
            <Table bordered size="sm">
              <thead>
                <tr>
                  <th>Monto</th><th>Descripción</th><th>Observaciones</th><th>Fecha</th><th></th>
                </tr>
              </thead>
              <tbody>
                {form.otrosCostos.map((oc, idx) => (
                  <tr key={idx}>
                    <td><Form.Control type="number" value={oc.monto} onChange={e => handleArrayChange('otrosCostos', idx, 'monto', e.target.value)} /></td>
                    <td><Form.Control value={oc.descripcion} onChange={e => handleArrayChange('otrosCostos', idx, 'descripcion', e.target.value)} /></td>
                    <td><Form.Control value={oc.observaciones} onChange={e => handleArrayChange('otrosCostos', idx, 'observaciones', e.target.value)} /></td>
                    <td><Form.Control type="datetime-local" value={oc.fecha} onChange={e => handleArrayChange('otrosCostos', idx, 'fecha', e.target.value)} /></td>
                    <td><Button variant="danger" size="sm" onClick={() => handleRemoveArray('otrosCostos', idx)}>-</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {loading && <div className="text-center py-2"><Spinner animation="border" variant="primary" /></div>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Crear nueva versión</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      {/* Modal de detalle con todos los datos de la respuesta */}
      <PresupuestoDetalleModal
        show={!!resultado}
        onClose={() => setResultado(null)}
        presupuesto={resultado}
      />
    </>
  );
};

export default NuevaVersionPresupuestoModal;
