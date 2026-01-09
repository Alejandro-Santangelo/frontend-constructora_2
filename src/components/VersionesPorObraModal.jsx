
import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllEmpresas } from '../store/slices/empresasSlice';
import apiService from '../services/api';

const VersionesPorObraModal = ({ show, handleClose }) => {
  const dispatch = useDispatch();
  const empresas = useSelector(state => state.empresas.empresas);
  const { empresaSeleccionada } = useEmpresa();
  const empresaId = empresaSeleccionada ? empresaSeleccionada.id : '';
  const [obraId, setObraId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [versiones, setVersiones] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [detalle, setDetalle] = useState(null);
  React.useEffect(() => {
    if (!empresas || empresas.length === 0) {
      dispatch(fetchAllEmpresas());
    }
  }, [dispatch, empresas]);
  const handleDetalle = (version) => {
    setDetalle(version);
  };
  const handleCerrarDetalle = () => {
    setDetalle(null);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSubmitted(true);
    try {
      const data = await apiService.get('/presupuestos/por-obra-todas-versiones', {
        empresaId,
        obraId
      });
      setVersiones(data);
    } catch (err) {
      setError(err.response?.data || err.message);
      setVersiones([]);
    } finally {
      setLoading(false);
    }
  };
  const handleModalClose = () => {
    setEmpresaId('');
    setObraId('');
    setVersiones([]);
    setError(null);
    setSubmitted(false);
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleModalClose} centered backdrop="static">
      <Modal.Header closeButton style={{ background: '#fff', borderBottom: '2px solid #007bff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Modal.Title>Obtener todas las versiones de presupuesto por obra</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="empresaId">
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
          <Form.Group controlId="obraId" className="mt-3">
            <Form.Label>ID de Obra</Form.Label>
            <Form.Control type="number" value={obraId} onChange={e => setObraId(e.target.value)} required />
          </Form.Group>
          <div className="d-flex gap-2 mt-4">
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Buscar versiones'}
            </Button>
            {submitted && !loading && Array.isArray(versiones) && versiones.length > 0 && (
              <Button variant="info" onClick={() => setDetalle(versiones[0])}>Ver detalle</Button>
            )}
          </div>
        </Form>
        {submitted && error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {submitted && !loading && Array.isArray(versiones) && versiones.length > 0 && (
          <div className="mt-4">
            <h5>Versiones encontradas:</h5>
            <div style={{overflowX: 'auto'}}>
              <table className="table table-bordered table-striped">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Fecha Creación</th>
                    <th>Versión</th>
                    <th>Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((v, idx) => (
                    <tr key={idx}>
                      <td>{v.id || v.id_presupuesto}</td>
                      <td>{v.descripcion}</td>
                      <td>{v.estado}</td>
                      <td>{v.fechaCreacion ? v.fechaCreacion.substring(0,10) : v.fecha_creacion?.substring(0,10)}</td>
                      <td>{v.version}</td>
                      <td>{v.montoTotal ? `$${v.montoTotal.toLocaleString()}` : v.monto_total ? `$${v.monto_total.toLocaleString()}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {detalle && (
          <Modal show={true} onHide={handleCerrarDetalle} centered dialogClassName="modal-xl">
            <Modal.Header closeButton>
              <Modal.Title>Detalle de versión #{detalle.id || detalle.id_presupuesto}</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{maxHeight: '90vh', minHeight: '70vh', overflowY: 'auto', minWidth: '900px', width: '100%'}}>
              <h6>Datos generales</h6>
              <ul>
                <li><strong>Descripción:</strong> {detalle.descripcion}</li>
                <li><strong>Estado:</strong> {detalle.estado}</li>
                <li><strong>Fecha de Creación:</strong> {detalle.fechaCreacion?.substring(0,10)}</li>
                <li><strong>Versión:</strong> {detalle.version}</li>
                <li><strong>Monto Total:</strong> ${detalle.montoTotal?.toLocaleString()}</li>
                <li><strong>Honorario Dirección Valor Fijo:</strong> ${detalle.honorarioDireccionValorFijo?.toLocaleString()}</li>
                <li><strong>Honorario Dirección Importe:</strong> ${detalle.honorarioDireccionImporte?.toLocaleString()}</li>
                <li><strong>Honorario Dirección Porcentaje:</strong> {detalle.honorarioDireccionPorcentaje}</li>
                <li><strong>Total Honorarios Profesionales:</strong> ${detalle.totalHonorariosProfesionales?.toLocaleString()}</li>
                <li><strong>Total Materiales:</strong> ${detalle.totalMateriales?.toLocaleString()}</li>
                <li><strong>Total Honorarios Dirección Obra:</strong> ${detalle.totalHonorariosDireccionObra?.toLocaleString()}</li>
                <li><strong>ID Empresa:</strong> {detalle.idEmpresa}</li>
                <li><strong>ID Obra:</strong> {detalle.idObra}</li>
              </ul>
              <h6>Profesionales</h6>
              {Array.isArray(detalle.profesionales) && detalle.profesionales.length > 0 ? (
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tipo</th>
                      <th>Honorario Hora</th>
                      <th>Honorario Día</th>
                      <th>Honorario Semana</th>
                      <th>Honorario Mes</th>
                      <th>Horas</th>
                      <th>Días</th>
                      <th>Semanas</th>
                      <th>Meses</th>
                      <th>Total Honorarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.profesionales.map((p, i) => (
                      <tr key={i}>
                        <td>{p.id}</td>
                        <td>{p.tipo}</td>
                        <td>${p.honorarioHora?.toLocaleString()}</td>
                        <td>${p.honorarioDia?.toLocaleString()}</td>
                        <td>${p.honorarioSemana?.toLocaleString()}</td>
                        <td>${p.honorarioMes?.toLocaleString()}</td>
                        <td>{p.horas}</td>
                        <td>{p.dias}</td>
                        <td>{p.semanas}</td>
                        <td>{p.meses}</td>
                        <td>${p.totalHonorarios?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p>No hay profesionales.</p>}
              <h6>Otros Costos</h6>
              {Array.isArray(detalle.otrosCostos) && detalle.otrosCostos.length > 0 ? (
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th>Observaciones</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.otrosCostos.map((c, i) => (
                      <tr key={i}>
                        <td>{c.id}</td>
                        <td>{c.descripcion}</td>
                        <td>${c.monto?.toLocaleString()}</td>
                        <td>{c.observaciones}</td>
                        <td>{c.fecha?.substring(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p>No hay otros costos.</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCerrarDetalle}>Cerrar</Button>
            </Modal.Footer>
          </Modal>
        )}
        {submitted && !loading && Array.isArray(versiones) && versiones.length === 0 && (
          <Alert variant="info" className="mt-3">No se encontraron versiones.</Alert>
        )}
      </Modal.Body>
      <Modal.Footer style={{ background: '#fff', borderTop: '2px solid #007bff' }}>
        <Button variant="secondary" onClick={handleModalClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default VersionesPorObraModal;
