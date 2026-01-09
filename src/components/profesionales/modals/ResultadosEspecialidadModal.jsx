
import React from 'react';
import { Modal, Button, Table, Alert } from 'react-bootstrap';

const ResultadosEspecialidadModal = ({ isOpen, onClose, results, isLoading, error }) => {
  return (
    <Modal show={isOpen} onHide={onClose} centered size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Resultados de la Búsqueda</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isLoading && <div className="text-center">Cargando...</div>}
        {error && <Alert variant="danger">{error}</Alert>}
        {!isLoading && !error && (
          results.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>ID Asignación</th>
                  <th>Profesional</th>
                  <th>Tipo</th>
                  <th>Obra</th>
                  <th>Estado Obra</th>
                  <th>Rol en Obra</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.idAsignacion}>
                    <td>{item.idAsignacion}</td>
                    <td>{item.nombreProfesional}</td>
                    <td>{item.tipoProfesional}</td>
                    <td>{item.nombreObra}</td>
                    <td>{item.estadoObra}</td>
                    <td>{item.rolEnObra}</td>
                    <td>{new Date(item.fechaDesde).toLocaleDateString()}</td>
                    <td>{new Date(item.fechaHasta).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p>No se encontraron asignaciones para los criterios de búsqueda.</p>
          )
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ResultadosEspecialidadModal;
