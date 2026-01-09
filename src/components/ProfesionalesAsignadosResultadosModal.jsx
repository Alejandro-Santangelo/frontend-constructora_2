import React from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import './FiltrarPorEstadoResultadosModal.css';

const ProfesionalesAsignadosResultadosModal = ({ show, onClose, resultados, loading, error }) => {
  return (
    <Modal show={show} onHide={onClose} size="lg" centered dialogClassName="modal-dialog-custom">
      <Modal.Header closeButton>
        <Modal.Title>Profesionales asignados</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-white border rounded shadow-sm">
        {loading && <div className="alert alert-info">Buscando profesionales asignados...</div>}
        {error && <div className="alert alert-danger">Error: {error}</div>}
        {!loading && !error && resultados.length === 0 && (
          <div className="alert alert-warning">No se encontraron profesionales asignados para los datos ingresados.</div>
        )}
        {!loading && !error && resultados.length > 0 && (
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Especialidad</th>
                  <th>Tarifa</th>
                  <th>Fecha de asignación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.nombre}</td>
                    <td>{p.especialidad}</td>
                    <td>{p.tarifa ? `$${p.tarifa.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}</td>
                    <td>{p.fechaAsignacion ? new Date(p.fechaAsignacion).toLocaleDateString() : '-'}</td>
                    <td>{p.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ProfesionalesAsignadosResultadosModal;
