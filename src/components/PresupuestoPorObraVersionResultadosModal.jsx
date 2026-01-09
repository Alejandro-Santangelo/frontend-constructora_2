import React from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import './FiltrarPorEstadoResultadosModal.css';

const PresupuestoPorObraVersionResultadosModal = ({ show, onClose, resultado, loading, error }) => {
  return (
    <Modal show={show} onHide={onClose} size="lg" centered dialogClassName="modal-dialog-custom">
      <Modal.Header closeButton>
        <Modal.Title>Presupuesto por obra y versión</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-white border rounded shadow-sm">
        {loading && <div className="alert alert-info">Buscando presupuesto...</div>}
        {error && <div className="alert alert-danger">Error: {error}</div>}
        {!loading && !error && resultado && (
          <>
            <h5 className="mb-3">Datos principales</h5>
            <table className="table table-bordered mb-4">
              <tbody>
                <tr><th>ID</th><td>{resultado.id}</td></tr>
                <tr><th>Descripción</th><td>{resultado.descripcion}</td></tr>
                <tr><th>Estado</th><td>{resultado.estado}</td></tr>
                <tr><th>Fecha de creación</th><td>{resultado.fechaCreacion ? new Date(resultado.fechaCreacion).toLocaleDateString() : '-'}</td></tr>
                <tr><th>Monto total</th><td>{resultado.montoTotal ? `$${resultado.montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}</td></tr>
                <tr><th>Versión</th><td>{resultado.version}</td></tr>
              </tbody>
            </table>

            <h5 className="mb-3">Profesionales</h5>
            <div className="table-responsive mb-4">
              <table className="table table-bordered table-hover">
                <thead className="table-dark">
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
                  {resultado.profesionales?.map(p => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.tipo}</td>
                      <td>{p.honorarioHora}</td>
                      <td>{p.honorarioDia}</td>
                      <td>{p.honorarioSemana}</td>
                      <td>{p.honorarioMes}</td>
                      <td>{p.horas}</td>
                      <td>{p.dias}</td>
                      <td>{p.semanas}</td>
                      <td>{p.meses}</td>
                      <td>{p.totalHonorarios ? `$${p.totalHonorarios.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h5 className="mb-3">Otros costos</h5>
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>ID</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Observaciones</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.otrosCostos?.map(c => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.descripcion}</td>
                      <td>{c.monto ? `$${c.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td>{c.observaciones}</td>
                      <td>{c.fecha ? new Date(c.fecha).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PresupuestoPorObraVersionResultadosModal;
