import React, { useState, useEffect } from 'react';
import empresasApiService from '../services/empresasApiService';

const EmpresasPage = ({ showNotification }) => {
  const [activeTab, setActiveTab] = useState('lista');
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [empresaParaEditar, setEmpresaParaEditar] = useState(null);
  const [estadisticas, setEstadisticas] = useState([]);
  const [cuitValidation, setCuitValidation] = useState({ disponible: null, validating: false });

  // Estados para formularios
  const [formData, setFormData] = useState({
    nombreEmpresa: '',
    cuit: '',
    direccionFiscal: '',
    telefono: '',
    email: '',
    representanteLegal: '',
    activa: true
  });

  // Definir botones de acción para el sidebar
  const actionButtons = [
    { id: 'lista', label: 'Lista de Empresas', icon: 'fas fa-list' },
    { id: 'buscar', label: 'Búsqueda Universal', icon: 'fas fa-search' },
    { id: 'estadisticas', label: 'Estadísticas', icon: 'fas fa-chart-bar' }
  ];

  // Botones de acción cuando hay una empresa seleccionada
  const selectedItemActions = selectedEmpresa ? [
    { 
      id: 'editar', 
      label: 'Editar Empresa', 
      icon: 'fas fa-edit',
      color: '#fd7e14',
      onClick: () => setEmpresaParaEditar(selectedEmpresa)
    },
    { 
      id: 'ver-estado', 
      label: 'Ver Estado', 
      icon: 'fas fa-info-circle',
      color: '#6f42c1',
      onClick: () => verificarEstado(selectedEmpresa.id)
    },
    selectedEmpresa.activa ? {
      id: 'desactivar',
      label: 'Desactivar',
      icon: 'fas fa-pause',
      color: '#FFD700',
      onClick: () => desactivarEmpresa(selectedEmpresa.id)
    } : {
      id: 'activar',
      label: 'Activar',
      icon: 'fas fa-play',
      color: '#20c997',
      onClick: () => activarEmpresa(selectedEmpresa.id)
    },
    {
      id: 'eliminar',
      label: 'Eliminar',
      icon: 'fas fa-trash',
      color: '#842029',
      onClick: () => eliminarEmpresa(selectedEmpresa.id)
    }
  ] : [];

  useEffect(() => {
    loadEmpresas();
    loadEstadisticas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      const data = await empresasApiService.getAll();
      setEmpresas(data || []);
    } catch (error) {
      let msg = 'Error cargando empresas';
      if (error && error.data) {
        msg = error.data.message || msg;
        if (error.data.validationErrors) {
          msg += ': ' + Object.entries(error.data.validationErrors).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
      }
      console.error('Error cargando empresas:', error);
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmpresasActivas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/empresas/activas');
      const data = await response.json();
      setEmpresas(data || []);
      showNotification('Empresas activas cargadas', 'success');
    } catch (error) {
      console.error('Error cargando empresas activas:', error);
      showNotification('Error cargando empresas activas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmpresasConClientes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/empresas/con-clientes');
      const data = await response.json();
      setEmpresas(data || []);
      showNotification('Empresas con clientes cargadas', 'success');
    } catch (error) {
      console.error('Error cargando empresas con clientes:', error);
      showNotification('Error cargando empresas con clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEstadisticas = async () => {
    try {
      const response = await fetch('/api/empresas/estadisticas');
      const data = await response.json();
      setEstadisticas(data || []);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const buscarEmpresa = async () => {
    if (!searchQuery.trim()) {
      showNotification('Ingrese un término de búsqueda', 'warning');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/empresas/buscar?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResult(data);
      showNotification('Búsqueda realizada', 'success');
    } catch (error) {
      console.error('Error en búsqueda:', error);
      showNotification('Error en búsqueda', 'error');
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const validarCuit = async (cuit) => {
    if (!cuit || cuit.length < 10) return;

    try {
      setCuitValidation({ disponible: null, validating: true });
      const response = await fetch(`http://localhost:8080/api/empresas/validar-cuit/${encodeURIComponent(cuit)}`);
      const data = await response.json();
      setCuitValidation({ disponible: data.disponible, validating: false });
    } catch (error) {
      console.error('Error validando CUIT:', error);
      setCuitValidation({ disponible: null, validating: false });
    }
  };

  const verificarEstado = async (identificador) => {
    try {
      const response = await fetch(`http://localhost:8080/api/empresas/${encodeURIComponent(identificador)}/estado`);
      const data = await response.json();
      showNotification(`Estado: ${data.existe ? 'Existe' : 'No existe'}, ${data.activa ? 'Activa' : 'Inactiva'}`, 'info');
      return data;
    } catch (error) {
      console.error('Error verificando estado:', error);
      showNotification('Error verificando estado', 'error');
    }
  };

  const activarEmpresa = async (id) => {
    try {
      const response = await fetch(`http://localhost:8080/api/empresas/${encodeURIComponent(id)}/activar`, {
        method: 'PATCH'
      });
      const message = await response.text();
      showNotification(message, 'success');
      loadEmpresas();
    } catch (error) {
      console.error('Error activando empresa:', error);
      showNotification('Error activando empresa', 'error');
    }
  };

  const desactivarEmpresa = async (id) => {
    try {
      const response = await fetch(`http://localhost:8080/api/empresas/${encodeURIComponent(id)}/desactivar`, {
        method: 'PATCH'
      });
      const message = await response.text();
      showNotification(message, 'success');
      loadEmpresas();
    } catch (error) {
      console.error('Error desactivando empresa:', error);
      showNotification('Error desactivando empresa', 'error');
    }
  };

  const crearEmpresa = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8080/api/empresas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const data = await response.json();
        showNotification('Empresa creada exitosamente', 'success');
        setFormData({
          nombreEmpresa: '',
          cuit: '',
          direccionFiscal: '',
          telefono: '',
          email: '',
          representanteLegal: '',
          activa: true
        });
        loadEmpresas();
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error creando empresa:', error);
      showNotification('Error creando empresa', 'error');
    } finally {
      setLoading(false);
    }
  };

  const actualizarEmpresa = async (id, data) => {
    try {
      const response = await fetch(`http://localhost:8080/api/empresas/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        showNotification('Empresa actualizada exitosamente', 'success');
        loadEmpresas();
        setEmpresaParaEditar(null);
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error actualizando empresa:', error);
      showNotification('Error actualizando empresa', 'error');
    }
  };

  const eliminarEmpresa = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta empresa?')) return;

    try {
      const response = await fetch(`http://localhost:8080/api/empresas/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const message = await response.text();
        showNotification(message, 'success');
        loadEmpresas();
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error eliminando empresa:', error);
      showNotification('Error eliminando empresa', 'error');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'lista':
        return (
          <div className="row">
            <div className="col-12">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5>Lista de Empresas</h5>
                  <div>
                    <button className="btn btn-success me-2" onClick={loadEmpresasActivas}>
                      <i className="fas fa-check-circle me-1"></i>Solo Activas
                    </button>
                    <button className="btn btn-info me-2" onClick={loadEmpresasConClientes}>
                      <i className="fas fa-users me-1"></i>Con Clientes
                    </button>
                    <button className="btn btn-primary" onClick={loadEmpresas}>
                      <i className="fas fa-sync-alt me-1"></i>Todas
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Cargando...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>CUIT</th>
                            <th>Email</th>
                            <th>Estado</th>
                            <th>Fecha Creación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empresas.map(empresa => {
                            const empresaId = empresa.id;
                            const selectedId = selectedEmpresa?.id;
                            const isSelected = selectedEmpresa && empresaId && selectedId && empresaId === selectedId;
                            
                            return (
                              <tr 
                                key={empresaId}
                                onClick={() => {
                                  // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                                  if (isSelected) {
                                    setSelectedEmpresa(null);
                                  } else {
                                    setSelectedEmpresa(empresa);
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                                className={isSelected ? 'table-active' : ''}
                              >
                                <td>
                                  <div className="d-flex align-items-center gap-2">
                                    {isSelected && (
                                      <i className="fas fa-check-circle text-success"></i>
                                    )}
                                    <span>{empresaId}</span>
                                  </div>
                                </td>
                              <td>{empresa.nombreEmpresa}</td>
                              <td>{empresa.cuit}</td>
                              <td>{empresa.email}</td>
                              <td>
                                <span className={`badge ${empresa.activa ? 'bg-success' : 'bg-danger'}`}>
                                  {empresa.activa ? 'Activa' : 'Inactiva'}
                                </span>
                              </td>
                              <td>{new Date(empresa.fechaCreacion).toLocaleDateString()}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'buscar':
        return (
          <div className="row">
            <div className="col-md-6">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <h5>Búsqueda Universal de Empresas</h5>
                  <small className="text-muted">Buscar por ID, CUIT o nombre</small>
                </div>
                <div className="card-body">
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ingrese ID, CUIT o nombre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && buscarEmpresa()}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={buscarEmpresa}
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm me-1"></span>
                      ) : (
                        <i className="fas fa-search me-1"></i>
                      )}
                      Buscar
                    </button>
                  </div>

                  <div className="alert alert-info">
                    <h6>Ejemplos de búsqueda:</h6>
                    <ul className="mb-0">
                      <li><strong>Por ID:</strong> 1, 2, 3...</li>
                      <li><strong>Por CUIT:</strong> 30-12345678-9</li>
                      <li><strong>Por nombre:</strong> Constructora ABC</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <h5>Resultado de Búsqueda</h5>
                </div>
                <div className="card-body">
                  {searchResult ? (
                    <div className="alert alert-success">
                      <h6><i className="fas fa-building me-2"></i>{searchResult.nombreEmpresa}</h6>
                      <hr />
                      <p><strong>ID:</strong> {searchResult.id}</p>
                      <p><strong>CUIT:</strong> {searchResult.cuit}</p>
                      <p><strong>Email:</strong> {searchResult.email}</p>
                      <p><strong>Dirección:</strong> {searchResult.direccionFiscal}</p>
                      <p><strong>Estado:</strong> 
                        <span className={`badge ms-1 ${searchResult.activa ? 'bg-success' : 'bg-danger'}`}>
                          {searchResult.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </p>
                      <p><strong>Fecha Creación:</strong> {new Date(searchResult.fechaCreacion).toLocaleString()}</p>
                    </div>
                  ) : (
                    <div className="text-muted text-center">
                      <i className="fas fa-search fa-3x mb-3"></i>
                      <p>Ingrese un término de búsqueda para encontrar empresas</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'crear':
        return (
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="card">
                <div className="card-header">
                  <h5>Crear Nueva Empresa</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={(e) => { e.preventDefault(); crearEmpresa(); }}>
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Nombre de la Empresa *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.nombreEmpresa}
                          onChange={(e) => setFormData({...formData, nombreEmpresa: e.target.value})}
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">CUIT *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="XX-XXXXXXXX-X"
                          value={formData.cuit}
                          onChange={(e) => {
                            setFormData({...formData, cuit: e.target.value});
                            validarCuit(e.target.value);
                          }}
                          required
                        />
                        {cuitValidation.validating && (
                          <small className="text-info">
                            <i className="fas fa-spinner fa-spin me-1"></i>Validando CUIT...
                          </small>
                        )}
                        {cuitValidation.disponible !== null && (
                          <small className={cuitValidation.disponible ? 'text-success' : 'text-danger'}>
                            <i className={`fas ${cuitValidation.disponible ? 'fa-check' : 'fa-times'} me-1`}></i>
                            {cuitValidation.disponible ? 'CUIT disponible' : 'CUIT ya existe'}
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Dirección Fiscal *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.direccionFiscal}
                        onChange={(e) => setFormData({...formData, direccionFiscal: e.target.value})}
                        required
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.telefono}
                          onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Representante Legal</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.representanteLegal}
                        onChange={(e) => setFormData({...formData, representanteLegal: e.target.value})}
                      />
                    </div>

                    <div className="mb-3 form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="activa"
                        checked={formData.activa}
                        onChange={(e) => setFormData({...formData, activa: e.target.checked})}
                      />
                      <label className="form-check-label" htmlFor="activa">
                        Empresa activa
                      </label>
                    </div>

                    <div className="d-grid">
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={loading || (cuitValidation.disponible === false)}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Creando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save me-2"></i>
                            Crear Empresa
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

      case 'estadisticas':
        return (
          <div className="row">
            <div className="col-12">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <h5>Estadísticas de Empresas</h5>
                </div>
                <div className="card-body">
                  {estadisticas.length > 0 ? (
                    <div className="row">
                      {estadisticas.map((empresa, index) => (
                        <div key={index} className="col-md-6 col-lg-4 mb-3">
                          <div className="card border-left-primary">
                            <div className="card-body">
                              <h6 className="card-title text-primary">{empresa.nombre}</h6>
                              <div className="row text-center">
                                <div className="col-4">
                                  <div className="h4 text-info">{empresa.totalClientes}</div>
                                  <small>Clientes</small>
                                </div>
                                <div className="col-4">
                                  <div className="h4 text-success">{empresa.totalObras}</div>
                                  <small>Obras</small>
                                </div>
                                <div className="col-4">
                                  <div className="h4 text-warning">{empresa.totalUsuarios}</div>
                                  <small>Usuarios</small>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted">
                      <i className="fas fa-chart-bar fa-3x mb-3"></i>
                      <p>No hay estadísticas disponibles</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Sección no encontrada</div>;
    }
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar con botones de acción */}
      <div className="bg-primary text-white" style={{ width: '260px', minHeight: '100vh', padding: '20px' }}>
        <h5 className="mb-4"><i className="fas fa-building me-2"></i>Empresas</h5>
        <div className="d-flex flex-column gap-2">
          <button
            className="btn btn-lg btn-success text-start"
            onClick={() => setActiveTab('crear')}
          >
            <i className="fas fa-plus me-2"></i>Nueva Empresa
          </button>
          <button
            className="btn btn-lg btn-info text-start"
            onClick={() => setActiveTab('lista')}
          >
            <i className="fas fa-list me-2"></i>Lista de Empresas
          </button>
          <button
            className="btn btn-lg btn-warning text-start"
            onClick={() => setActiveTab('buscar')}
          >
            <i className="fas fa-search me-2"></i>Búsqueda Universal
          </button>
          <button
            className="btn btn-lg btn-danger text-start"
            onClick={() => setActiveTab('estadisticas')}
          >
            <i className="fas fa-chart-bar me-2"></i>Estadísticas
          </button>
          <>
            <hr className="border-secondary my-3" />
            <small className="text-muted">Acciones del elemento</small>
            {selectedEmpresa ? (
              selectedItemActions.map(action => (
                <button
                  key={action.id}
                  className="btn btn-lg text-start text-white"
                  onClick={action.onClick}
                  style={{ backgroundColor: action.color }}
                >
                  <i className={`${action.icon} me-2`}></i>{action.label}
                </button>
              ))
            ) : (
              <>
                <button
                  className="btn btn-lg text-start text-white"
                  disabled
                  style={{ backgroundColor: '#6c757d', opacity: 0.5 }}
                >
                  <i className="fas fa-edit me-2"></i>Editar Empresa
                </button>
                <button
                  className="btn btn-lg text-start text-white"
                  disabled
                  style={{ backgroundColor: '#6c757d', opacity: 0.5 }}
                >
                  <i className="fas fa-info-circle me-2"></i>Ver Estado
                </button>
                <button
                  className="btn btn-lg text-start text-white"
                  disabled
                  style={{ backgroundColor: '#6c757d', opacity: 0.5 }}
                >
                  <i className="fas fa-pause me-2"></i>Desactivar
                </button>
                <button
                  className="btn btn-lg text-start text-white"
                  disabled
                  style={{ backgroundColor: '#6c757d', opacity: 0.5 }}
                >
                  <i className="fas fa-trash me-2"></i>Eliminar
                </button>
              </>
            )}
          </>
        </div>
      </div>

      {/* Contenido principal */}
      <div 
        className="flex-grow-1 p-4" 
        style={{ backgroundColor: '#f8f9fa' }}
        onClick={() => setSelectedEmpresa(null)}
      >
        <div className="container-fluid">
          <div className="d-sm-flex align-items-center justify-content-between mb-4">
            <h1 className="h3 mb-0 text-gray-800">
              <i className="fas fa-building me-2"></i>
              Gestión de Empresas
            </h1>
          </div>

          {/* Contenido de las pestañas */}
          {renderTabContent()}

          {/* Modal para editar empresa */}
          {empresaParaEditar && (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Editar Empresa</h5>
                    <button 
                      type="button" 
                      className="btn-close"
                      onClick={() => setEmpresaParaEditar(null)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      actualizarEmpresa(empresaParaEditar.id, empresaParaEditar);
                    }}>
                      <div className="mb-3">
                        <label className="form-label">Nombre de la Empresa</label>
                        <input
                          type="text"
                          className="form-control"
                          value={empresaParaEditar.nombreEmpresa}
                          onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, nombreEmpresa: e.target.value})}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">CUIT</label>
                        <input
                          type="text"
                          className="form-control"
                          value={empresaParaEditar.cuit}
                          onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, cuit: e.target.value})}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Dirección Fiscal</label>
                        <input
                          type="text"
                          className="form-control"
                          value={empresaParaEditar.direccionFiscal || ''}
                          onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, direccionFiscal: e.target.value})}
                        />
                      </div>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Teléfono</label>
                          <input
                            type="text"
                            className="form-control"
                            value={empresaParaEditar.telefono || ''}
                            onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, telefono: e.target.value})}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={empresaParaEditar.email || ''}
                            onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, email: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Representante Legal</label>
                        <input
                          type="text"
                          className="form-control"
                          value={empresaParaEditar.representanteLegal || ''}
                          onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, representanteLegal: e.target.value})}
                        />
                      </div>
                      <div className="mb-3 form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="editActiva"
                          checked={empresaParaEditar.activa}
                          onChange={(e) => setEmpresaParaEditar({...empresaParaEditar, activa: e.target.checked})}
                        />
                        <label className="form-check-label" htmlFor="editActiva">
                          Empresa activa
                        </label>
                      </div>
                      <div className="d-flex justify-content-end">
                        <button 
                          type="button" 
                          className="btn btn-secondary me-2"
                          onClick={() => setEmpresaParaEditar(null)}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary">
                          <i className="fas fa-save me-1"></i>Guardar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmpresasPage;