
import './PresupuestoDetalleModal.css';
import React from 'react';
import { Modal, Button, Table, Row, Col } from 'react-bootstrap';

const PresupuestoDetalleModal = ({ show, onClose, presupuesto }) => {
  if (!presupuesto) return null;
  return (
    <Modal show={show} onHide={onClose} size="xl" centered backdrop="static" dialogClassName="modal-detalle-presupuesto" style={{ minWidth: '90vw' }}>
      <Modal.Header closeButton>
        <Modal.Title>Detalle del Presupuesto #{presupuesto.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ background: '#f8f9fa', padding: 32 }}>
        <Row>
          <Col md={6}>
            <h5>Datos generales</h5>
            <Table borderless size="sm">
              <tbody>
                <tr><td><b>ID</b></td><td>{presupuesto.id}</td></tr>
                <tr><td><b>Descripción</b></td><td>{presupuesto.descripcion}</td></tr>
                <tr><td><b>Estado</b></td><td>{presupuesto.estado}</td></tr>
                <tr><td><b>Fecha creación</b></td><td>{presupuesto.fechaCreacion}</td></tr>
                <tr><td><b>Fecha aprobación</b></td><td>{presupuesto.fechaAprobacionTexto || '-'}</td></tr>
                <tr><td><b>Fecha emisión</b></td><td>{presupuesto.fechaEmision || '-'}</td></tr>
                <tr><td><b>Fecha validez</b></td><td>{presupuesto.fechaValidezTexto || '-'}</td></tr>
                <tr><td><b>Empresa</b></td><td>{presupuesto.idEmpresa}</td></tr>
                <tr><td><b>Obra</b></td><td>{presupuesto.idObra}</td></tr>
                <tr><td><b>Versión</b></td><td>{presupuesto.version}</td></tr>
              </tbody>
            </Table>
          </Col>
          <Col md={6}>
            <h5>Montos</h5>
            <Table borderless size="sm">
              <tbody>
                <tr><td><b>Monto total</b></td><td>${presupuesto.montoTotal?.toLocaleString()}</td></tr>
                <tr><td><b>Honorario dirección (fijo)</b></td><td>${presupuesto.honorarioDireccionValorFijo?.toLocaleString()}</td></tr>
                <tr><td><b>Honorario dirección (%)</b></td><td>{presupuesto.honorarioDireccionPorcentaje}%</td></tr>
                <tr><td><b>Importe dirección</b></td><td>${presupuesto.honorarioDireccionImporte?.toLocaleString()}</td></tr>
                <tr><td><b>Total honorarios profesionales</b></td><td>${presupuesto.totalHonorariosProfesionales?.toLocaleString()}</td></tr>
                <tr><td><b>Total materiales</b></td><td>${presupuesto.totalMateriales?.toLocaleString()}</td></tr>
                <tr><td><b>Total honorarios dirección obra</b></td><td>${presupuesto.totalHonorariosDireccionObra?.toLocaleString()}</td></tr>
                <tr>
                  <td><b>Otros costos</b></td>
                  <td>
                    {Array.isArray(presupuesto.otrosCostos) && presupuesto.otrosCostos.length > 0 ? (
                      <Table bordered size="sm" style={{ background: '#fff', marginBottom: 0 }}>
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Descripción</th>
                            <th>Monto</th>
                            <th>Fecha</th>
                            <th>Observaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {presupuesto.otrosCostos.map(oc => (
                            <tr key={oc.id}>
                              <td>{oc.id}</td>
                              <td>{oc.descripcion}</td>
                              <td>${oc.monto?.toLocaleString()}</td>
                              <td>{oc.fecha || '-'}</td>
                              <td>{oc.observaciones || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : '-'}
                  </td>
                </tr>
              </tbody>
            </Table>
          </Col>
        </Row>
        <Row className="mt-4">
          <Col>
            <h5>Profesionales</h5>
            <Table bordered size="sm" style={{ background: '#fff' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Honorario Mes</th>
                  <th>Honorario Semana</th>
                  <th>Honorario Día</th>
                  <th>Honorario Hora</th>
                  <th>Meses</th>
                  <th>Semanas</th>
                  <th>Días</th>
                  <th>Horas</th>
                  <th>Total Honorarios</th>
                </tr>
              </thead>
              <tbody>
                {presupuesto.profesionales?.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.tipo}</td>
                    <td>${p.honorarioMes?.toLocaleString()}</td>
                    <td>${p.honorarioSemana?.toLocaleString()}</td>
                    <td>${p.honorarioDia?.toLocaleString()}</td>
                    <td>${p.honorarioHora?.toLocaleString()}</td>
                    <td>{p.meses}</td>
                    <td>{p.semanas}</td>
                    <td>{p.dias}</td>
                    <td>{p.horas}</td>
                    <td>${p.totalHonorarios?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PresupuestoDetalleModal;
