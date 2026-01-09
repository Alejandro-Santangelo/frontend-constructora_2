import React from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import './FiltrarPorEstadoResultadosModal.css';

const FiltrarPorEstadoResultadosModal = ({ show, onClose, resultados, loading, error, empresas, obras }) => {
  // Funciones para obtener nombre por id
  const getNombreEmpresa = id => {
    const empresa = empresas.find(e => e.id === Number(id));
    return empresa ? empresa.nombre_empresa : id;
  };
  const getNombreObra = id => {
    const obra = obras.find(o => o.id === Number(id));
    return obra ? obra.nombre : id;
  };

  return (
  <Modal show={show} onHide={onClose} size="lg" centered dialogClassName="modal-dialog-custom">
      <Modal.Header closeButton>
        <Modal.Title>Resultados de la búsqueda</Modal.Title>
      </Modal.Header>
  <Modal.Body className="bg-white border rounded shadow-sm">
        {loading && <div className="alert alert-info">Buscando presupuestos...</div>}
        {error && <div className="alert alert-danger">Error: {error}</div>}
        {!loading && !error && resultados.length === 0 && (
          <div className="alert alert-warning">No se encontraron presupuestos con los filtros seleccionados.</div>
        )}
        {!loading && !error && resultados.length > 0 && (
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>DESCRIPCIÓN</th>
                  <th>ESTADO</th>
                  <th>FECHA DE CREACIÓN</th>
                  <th>EMPRESA</th>
                  <th>OBRA</th>
                  <th>MONTO TOTAL</th>
                  <th>VÁLIDO HASTA</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.descripcion}</td>
                    <td>{p.estado}</td>
                    <td>{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : '-'}</td>
                    <td>{getNombreEmpresa(p.idEmpresa)}</td>
                    <td>{getNombreObra(p.idObra)}</td>
                    <td>${p.montoTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{p.fecha_validez ? new Date(p.fecha_validez).toLocaleDateString() : '-'}</td>
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

export default FiltrarPorEstadoResultadosModal;
