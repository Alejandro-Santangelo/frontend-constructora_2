import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllEmpresas } from '../store/slices/empresasSlice';
import { getCurrentTenant, setCurrentTenant } from '../services/api';
import { useEmpresa } from '../EmpresaContext';

const TenantSelector = ({ showNotification }) => {
  const empresas = useSelector(state => state.empresas.empresas);
  const dispatch = useDispatch();
  const [currentTenant, setCurrentTenantState] = useState(getCurrentTenant());
  const [showModal, setShowModal] = useState(false);
  const loading = useSelector(state => state.empresas.loading);
  const { usuarioAutenticado } = useEmpresa(); // 🔐 Obtener rol del usuario

  useEffect(() => {
    if (!empresas || empresas.length === 0) {
      dispatch(fetchAllEmpresas());
    }
  }, []);


  const handleTenantChange = (tenantId) => {
    setCurrentTenant(tenantId);
    setCurrentTenantState(tenantId);
    setShowModal(false);
    
    if (showNotification) {
      const empresa = empresas.find(e => e.id === tenantId);
  showNotification(`Cambiado a: ${empresa?.nombreEmpresa || empresa?.nombre || 'Empresa'}`, 'success');
    }
    
    // Recargar la página para actualizar todos los datos
    window.location.reload();
  };

  const getCurrentEmpresa = () => {
    return empresas.find(e => e.id === currentTenant);
  };

  const currentEmpresa = getCurrentEmpresa();

  return (
    <>
      {/* Selector en la navbar */}
      <div className="dropdown">
        <button
          className="btn btn-outline-light dropdown-toggle d-flex align-items-center"
          type="button"
          onClick={() => setShowModal(true)}
          aria-expanded="false"
        >
          <i className="fas fa-building me-2"></i>
          <div className="text-start">
            <div className="fw-bold">
              {currentEmpresa?.nombreEmpresa || currentEmpresa?.nombre || 'Seleccionar Empresa'}
            </div>
            <div className="d-flex align-items-center gap-2">
              {currentEmpresa && (
                <small className="text-muted">{currentEmpresa.cuit}</small>
              )}
              {usuarioAutenticado?.rol && (
                <>
                  {currentEmpresa && <small className="text-muted">|</small>}
                  <small className="badge bg-info bg-opacity-75 text-dark">
                    {usuarioAutenticado.rol}
                  </small>
                </>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Modal de selección */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-building me-2"></i>
                  Seleccionar Empresa (Tenant)
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p className="text-muted mt-2">Cargando empresas...</p>
                  </div>
                ) : empresas.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="fas fa-building text-muted fs-1 mb-3"></i>
                    <p className="text-muted">No hay empresas registradas</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowModal(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <div className="row g-3">
                    {empresas.map((empresa) => (
                      <div key={empresa.id} className="col-md-6">
                        <div
                          className={`card h-100 cursor-pointer ${
                            empresa.id === currentTenant
                              ? 'border-primary bg-primary bg-opacity-10'
                              : 'border-light'
                          }`}
                          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                          onClick={() => handleTenantChange(empresa.id)}
                        >
                          <div className="card-body">
                            <div className="d-flex align-items-center">
                              <div className="rounded-circle p-3 me-3 bg-primary bg-opacity-10">
                                <i className="fas fa-building text-primary"></i>
                              </div>
                              <div className="flex-grow-1">
                                <h6 className="mb-1 fw-bold">
                                  {empresa.nombreEmpresa || empresa.nombre}
                                </h6>
                                <small className="text-muted">
                                  CUIT: {empresa.cuit}
                                </small>
                                {empresa.ciudad && (
                                  <div>
                                    <small className="text-muted">
                                      <i className="fas fa-map-marker-alt me-1"></i>
                                      {empresa.ciudad}
                                    </small>
                                  </div>
                                )}
                              </div>
                              {empresa.id === currentTenant && (
                                <i className="fas fa-check-circle text-primary"></i>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <div className="d-flex align-items-center w-100">
                  <div className="me-auto">
                    <small className="text-muted">
                      <i className="fas fa-info-circle me-1"></i>
                      La empresa seleccionada determina qué datos se muestran
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TenantSelector;