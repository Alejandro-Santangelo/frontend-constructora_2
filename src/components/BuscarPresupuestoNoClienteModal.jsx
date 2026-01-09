import React, { useState } from 'react';

const BuscarPresupuestoNoClienteModal = ({ show, onClose, onBuscar, loading }) => {
  const [direccionObraCalle, setDireccionObraCalle] = useState('');
  const [direccionObraAltura, setDireccionObraAltura] = useState('');
  const [direccionObraPiso, setDireccionObraPiso] = useState('');
  const [direccionObraDepartamento, setDireccionObraDepartamento] = useState('');
  const [numeroVersion, setNumeroVersion] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!direccionObraCalle.trim() || !direccionObraAltura.trim()) {
      alert('Calle y Altura son obligatorios');
      return;
    }
    onBuscar({
      direccionObraCalle: direccionObraCalle.trim(),
      direccionObraAltura: direccionObraAltura.trim(),
      direccionObraPiso: direccionObraPiso.trim() || null,
      direccionObraDepartamento: direccionObraDepartamento.trim() || null,
      numeroVersion: numeroVersion ? parseInt(numeroVersion, 10) : null
    });
  };

  const handleClose = () => {
    setDireccionObraCalle('');
    setDireccionObraAltura('');
    setDireccionObraPiso('');
    setDireccionObraDepartamento('');
    setNumeroVersion('');
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '500px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Buscar Presupuesto para Editar</h5>
            <button type="button" className="btn-close" onClick={handleClose} disabled={loading}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Dirección de la Obra - Calle *</label>
                <input
                  type="text"
                  className="form-control"
                  value={direccionObraCalle}
                  onChange={(e) => setDireccionObraCalle(e.target.value)}
                  placeholder="Ej: La Granja"
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Dirección de la Obra - Altura *</label>
                <input
                  type="text"
                  className="form-control"
                  value={direccionObraAltura}
                  onChange={(e) => setDireccionObraAltura(e.target.value)}
                  placeholder="Ej: 193"
                  required
                  disabled={loading}
                />
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Piso (opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={direccionObraPiso}
                    onChange={(e) => setDireccionObraPiso(e.target.value)}
                    placeholder="Ej: 3"
                    disabled={loading}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Departamento (opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={direccionObraDepartamento}
                    onChange={(e) => setDireccionObraDepartamento(e.target.value)}
                    placeholder="Ej: A"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Número de Versión (opcional)</label>
                <input
                  type="number"
                  className="form-control"
                  value={numeroVersion}
                  onChange={(e) => setNumeroVersion(e.target.value)}
                  placeholder="Si no se especifica, se busca la última versión"
                  min="1"
                  disabled={loading}
                />
                <small className="form-text text-muted">
                  Deja en blanco para obtener la última versión automáticamente
                </small>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin me-1"></i>
                      Buscando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-search me-1"></i>
                      Buscar y Editar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuscarPresupuestoNoClienteModal;
