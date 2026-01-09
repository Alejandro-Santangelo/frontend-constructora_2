import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form, Table, Spinner, Alert } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { selectEmpresas } from '../store/slices/empresasSlice';
import SeleccionarProfesionalesModal from './SeleccionarProfesionalesModal';

function AsignarProfesionalesModal({ show, onClose, onAsignar }) {
  // ...existing code...
  const [showSeleccionarModal, setShowSeleccionarModal] = useState(false);
  const [asignacionActual, setAsignacionActual] = useState(null); // índice de la fila que abre el modal
  const empresas = useSelector(selectEmpresas);
  const presupuestos = useSelector(state => state.presupuestos.lista);
  const profesionales = useSelector(state => (state.profesionales && state.profesionales.lista) ? state.profesionales.lista : []);
  const obras = useSelector(state => state.obras.obras);
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestoId, setPresupuestoId] = useState('');
  const [obraId, setObraId] = useState('');
  const [version, setVersion] = useState('');
  const [asignaciones, setAsignaciones] = useState([
    {
      presupuestoProfesionalId: '',
      profesionalId: '',
      fechaDesde: '',
      fechaHasta: '',
      rolEnObra: '',
      valorHoraAsignado: ''
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  
  const handleAsignacionChange = (idx, field, value) => {
    const updated = asignaciones.map((asig, i) => i === idx ? { ...asig, [field]: value } : asig);
    setAsignaciones(updated);
  };

  const handleAddAsignacion = () => {
    setAsignaciones([...asignaciones, {
      presupuestoProfesionalId: '',
      profesionalId: '',
      fechaDesde: '',
      fechaHasta: '',
      rolEnObra: '',
      valorHoraAsignado: ''
    }]);
  };

  const handleRemoveAsignacion = (idx) => {
    setAsignaciones(asignaciones.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setError(null);
    setLoading(true);
    if (!empresaSeleccionada || !presupuestoId || !obraId) {
      setFormError('Empresa, presupuesto y obra son obligatorios.');
      setLoading(false);
      return;
    }
    try {
      const body = { asignaciones: asignaciones.map(a => ({
        ...a,
        presupuestoProfesionalId: Number(a.presupuestoProfesionalId),
        profesionalId: Number(a.profesionalId),
        valorHoraAsignado: Number(a.valorHoraAsignado)
      })) };
      const params = new URLSearchParams();
      params.append('presupuestoId', presupuestoId);
  params.append('empresaId', empresaSeleccionada.id);
  params.append('obraId', obraId);
  if (version) params.append('version', version);
      const res = await fetch(`/api/presupuestos/asignar-profesionales?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (onAsignar) onAsignar(data);
      setLoading(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al asignar profesionales');
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Asignar Profesionales al Presupuesto</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <div className="row mb-3">
            <div className="col-md-3">
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
            </div>
            <div className="col-md-3">
              <Form.Label>Presupuesto</Form.Label>
              <Form.Select value={presupuestoId} onChange={e => setPresupuestoId(e.target.value)}>
                <option value="">Seleccione un presupuesto...</option>
                {presupuestos && presupuestos.length > 0 ? presupuestos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre || `Presupuesto #${p.id}`}</option>
                )) : <option disabled value="">No hay presupuestos</option>}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Obra</Form.Label>
              <Form.Select value={obraId} onChange={e => setObraId(e.target.value)}>
                <option value="">Seleccione una obra...</option>
                {obras && obras.length > 0 ? obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre || `Obra #${o.id}`}</option>
                )) : <option disabled value="">No hay obras</option>}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Versión (opcional)</Form.Label>
              <Form.Control type="number" value={version} onChange={e => setVersion(e.target.value)} min={1} placeholder="Última" />
            </div>
          </div>
          <h5>Asignaciones</h5>
          <Table bordered size="sm" responsive>
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Fecha Desde</th>
                <th>Fecha Hasta</th>
                <th>Rol en Obra</th>
                <th>Valor Hora</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((asig, idx) => (
                <tr key={idx}>
                  <td>
                    <Button variant="info" size="sm" onClick={() => { setAsignacionActual(idx); setShowSeleccionarModal(true); }}>
                      Seleccionar profesionales
                    </Button>
                    <div style={{ marginTop: 4 }}>
                      {Array.isArray(asig.profesionalId)
                        ? asig.profesionalId.map(pid => {
                            const prof = profesionales.find(p => p.id === pid);
                            return prof ? <span key={pid} className="badge bg-info me-1">{prof.nombre}</span> : null;
                          })
                        : (asig.profesionalId ? (() => {
                            const prof = profesionales.find(p => p.id === Number(asig.profesionalId));
                            return prof ? <span className="badge bg-info">{prof.nombre}</span> : null;
                          })() : null)
                      }
                    </div>
                  </td>
                  <td>
                    <Form.Control type="date" value={asig.fechaDesde} onChange={e => handleAsignacionChange(idx, 'fechaDesde', e.target.value)} />
                  </td>
                  <td>
                    <Form.Control type="date" value={asig.fechaHasta} onChange={e => handleAsignacionChange(idx, 'fechaHasta', e.target.value)} />
                  </td>
                  <td>
                    <Form.Control type="text" value={asig.rolEnObra} onChange={e => handleAsignacionChange(idx, 'rolEnObra', e.target.value)} />
                  </td>
                  <td>
                    <Form.Control type="number" value={asig.valorHoraAsignado} onChange={e => handleAsignacionChange(idx, 'valorHoraAsignado', e.target.value)} min={0} />
                  </td>
                  <td>
                    <Button variant="danger" size="sm" onClick={() => handleRemoveAsignacion(idx)} disabled={asignaciones.length === 1}>Eliminar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {showSeleccionarModal && (
            <SeleccionarProfesionalesModal
              show={showSeleccionarModal}
              onClose={() => setShowSeleccionarModal(false)}
              onSelect={ids => {
                // Actualiza la asignación actual con los IDs seleccionados
                const updated = asignaciones.map((asig, i) =>
                  i === asignacionActual ? { ...asig, profesionalId: ids } : asig
                );
                setAsignaciones(updated);
                setShowSeleccionarModal(false);
              }}
            />
          )}
          <Button variant="secondary" onClick={handleAddAsignacion} className="mb-3">Agregar asignación</Button>
          {formError && <Alert variant="warning">{formError}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="d-flex justify-content-end">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <Spinner size="sm" animation="border" /> : 'Asignar Profesionales'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default AsignarProfesionalesModal;
