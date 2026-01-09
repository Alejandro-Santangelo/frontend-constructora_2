import React, { useState } from 'react';
import { Modal, Button, Table, Alert } from 'react-bootstrap';
import PresupuestoDetalleModal from './PresupuestoDetalleModal';

const PresupuestosPorEstadoResultadosModal = ({ show, onClose, resultados, error }) => {
  const [detallePresupuesto, setDetallePresupuesto] = useState(null);

  return (
    <>
      <Modal show={show} onHide={onClose} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Resultados de la búsqueda</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error ? (
            <Alert variant="danger">{error}</Alert>
          ) : resultados && resultados.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                  <th>Empresa</th>
                  <th>Obra</th>
                  <th>Versión</th>
                  <th>Total Honorarios</th>
                  <th>Total Materiales</th>
                  <th>Total Dirección</th>
                  <th>Monto Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.descripcion}</td>
                    <td>{p.estado}</td>
                    <td>{p.fechaCreacion}</td>
                    <td>{p.nombre_empresa || p.empresaNombre || p.empresa || p.idEmpresa}</td>
                    <td>{p.idObra}</td>
                    <td>{p.version}</td>
                    <td>{p.totalHonorariosProfesionales}</td>
                    <td>{p.totalMateriales}</td>
                    <td>{p.totalHonorariosDireccionObra}</td>
                    <td>{p.montoTotal}</td>
                    <td>
                      <Button size="sm" variant="info" onClick={() => setDetallePresupuesto(p)}>
                        Ver Detalles
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="info">No se encontraron presupuestos para los filtros seleccionados.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </Modal.Footer>
      </Modal>
      <PresupuestoDetalleModal
        show={!!detallePresupuesto}
        onClose={() => setDetallePresupuesto(null)}
        presupuesto={detallePresupuesto}
      />
    </>
  );
};

export default PresupuestosPorEstadoResultadosModal;
