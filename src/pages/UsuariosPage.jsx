import React, { useState, useEffect } from 'react';
import api from '../services/api';

const UsuariosPage = ({ showNotification }) => {
  const [activeTab, setActiveTab] = useState('lista');
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [empresaId, setEmpresaId] = useState('1');
  const [rolFilter, setRolFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('todos');

  // Roles disponibles según sistema típico de usuarios
  const rolesDisponibles = [
    'ADMIN',
    'GERENTE',
    'SUPERVISOR',
    'EMPLEADO',
    'CLIENTE',
    'CONTADOR',
    'ARQUITECTO',
    'INGENIERO'
  ];

  // Estados de usuario
  const estadosDisponibles = [
    'ACTIVO',
    'INACTIVO',
    'BLOQUEADO',
    'PENDIENTE'
  ];

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    rol: 'EMPLEADO',
    estado: 'ACTIVO',
    password: '',
    confirmPassword: '',
    fechaIngreso: new Date().toISOString().split('T')[0]
  });

  const [pagination, setPagination] = useState({
    page: 0,
    size: 20,
    sort: 'id',
    direction: 'ASC'
  });

  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => {
    loadUsuarios();
  }, [empresaId, rolFilter, estadoFilter, pagination]);

  const loadUsuarios = async () => {
    try {
      setLoading(true);
      let url = '';
      
      if (rolFilter === 'todos' && estadoFilter === 'todos') {
        // GET /usuarios con paginación
        url = `/api/usuarios?empresaId=${empresaId}&page=${pagination.page}&size=${pagination.size}&sort=${pagination.sort}&direction=${pagination.direction}`;
      } else if (rolFilter !== 'todos') {
        // GET /usuarios/rol/{rol}
        url = `/api/usuarios/rol/${rolFilter}?empresaId=${empresaId}&page=${pagination.page}&size=${pagination.size}`;
      } else if (estadoFilter !== 'todos') {
        // GET /usuarios/estado/{estado}
        url = `/api/usuarios/estado/${estadoFilter}?empresaId=${empresaId}&page=${pagination.page}&size=${pagination.size}`;
      }

      const data = await api.get(url);
      setUsuarios(data.content || data.resultado || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      showNotification('Error cargando usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsuariosPorEmpresa = async (empresaSeleccionada) => {
    try {
      setLoading(true);
      const data = await api.get(`/api/usuarios/empresa/${empresaSeleccionada}`);
      setUsuarios(data.resultado || []);
      showNotification(`Usuarios de empresa ${empresaSeleccionada} cargados`, 'success');
    } catch (error) {
      console.error('Error cargando usuarios por empresa:', error);
      showNotification('Error cargando usuarios por empresa', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTodosLosUsuarios = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/api/usuarios/todos?empresaId=${empresaId}`);
      setUsuarios(data || []);
      showNotification('Todos los usuarios cargados', 'success');
    } catch (error) {
      console.error('Error cargando todos los usuarios:', error);
      showNotification('Error cargando todos los usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const buscarUsuario = async () => {
    if (!searchQuery.trim()) {
      showNotification('Ingrese un término de búsqueda', 'warning');
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: searchQuery,
        empresaId: empresaId
      });
      
      const data = await api.get(`/api/usuarios/buscar?${params}`);
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

  const crearUsuario = async () => {
    if (formData.password !== formData.confirmPassword) {
      showNotification('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/api/usuarios?empresaId=${empresaId}`, {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        rol: formData.rol,
        estado: formData.estado,
        password: formData.password,
        fechaIngreso: formData.fechaIngreso
      });
      
      if (response.ok) {
        showNotification('Usuario creado exitosamente', 'success');
        setFormData({
          nombre: '',
          email: '',
          telefono: '',
          rol: 'EMPLEADO',
          estado: 'ACTIVO',
          password: '',
          confirmPassword: '',
          fechaIngreso: new Date().toISOString().split('T')[0]
        });
        loadUsuarios();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error creando usuario');
      }
    } catch (error) {
      console.error('Error creando usuario:', error);
      showNotification(error.message || 'Error creando usuario', 'error');
    } finally {
      setLoading(false);
    }
  };

  const actualizarUsuario = async (id, data) => {
    try {
      await api.put(`/api/usuarios/${id}`, data);
      showNotification('Usuario actualizado exitosamente', 'success');
      loadUsuarios();
      setSelectedUsuario(null);
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      showNotification('Error actualizando usuario', 'error');
    }
  };

  const cambiarEstadoUsuario = async (id, nuevoEstado) => {
    try {
      await api.patch(`/api/usuarios/${id}/estado?estado=${nuevoEstado}&empresaId=${empresaId}`);
      showNotification(`Estado cambiado a ${nuevoEstado}`, 'success');
      loadUsuarios();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showNotification('Error cambiando estado', 'error');
    }
  };

  const eliminarUsuario = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este usuario?')) return;

    try {
      await api.delete(`/api/usuarios/${id}?empresaId=${empresaId}`);
      showNotification('Usuario eliminado exitosamente', 'success');
      loadUsuarios();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      showNotification('Error eliminando usuario', 'error');
    }
  };

  const resetearPassword = async (id) => {
    if (!window.confirm('¿Está seguro de resetear la contraseña de este usuario?')) return;

    try {
      await api.post(`/api/usuarios/${id}/reset-password?empresaId=${empresaId}`);
      showNotification('Contraseña reseteada exitosamente', 'success');
    } catch (error) {
      console.error('Error reseteando contraseña:', error);
      showNotification('Error reseteando contraseña', 'error');
    }
  };

  const getRolBadgeClass = (rol) => {
    switch (rol) {
      case 'ADMIN': return 'bg-danger';
      case 'GERENTE': return 'bg-primary';
      case 'SUPERVISOR': return 'bg-warning';
      case 'EMPLEADO': return 'bg-success';
      case 'CLIENTE': return 'bg-info';
      case 'CONTADOR': return 'bg-secondary';
      case 'ARQUITECTO': return 'bg-primary';
      case 'INGENIERO': return 'bg-success';
      default: return 'bg-secondary';
    }
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'ACTIVO': return 'bg-success';
      case 'INACTIVO': return 'bg-secondary';
      case 'BLOQUEADO': return 'bg-danger';
      case 'PENDIENTE': return 'bg-warning';
      default: return 'bg-secondary';
    }
  };

  const changePage = (newPage) => {
    setPagination({...pagination, page: newPage});
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'lista':
        return (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5>Lista de Usuarios</h5>
                  <div className="d-flex align-items-center">
                    <select 
                      className="form-select me-2" 
                      style={{width: 'auto'}}
                      value={empresaId}
                      onChange={(e) => setEmpresaId(e.target.value)}
                    >
                      <option value="1">Empresa 1</option>
                      <option value="2">Empresa 2</option>
                      <option value="3">Empresa 3</option>
                    </select>
                    <select 
                      className="form-select me-2" 
                      style={{width: 'auto'}}
                      value={rolFilter}
                      onChange={(e) => setRolFilter(e.target.value)}
                    >
                      <option value="todos">Todos los roles</option>
                      {rolesDisponibles.map(rol => (
                        <option key={rol} value={rol}>{rol}</option>
                      ))}
                    </select>
                    <select 
                      className="form-select me-2" 
                      style={{width: 'auto'}}
                      value={estadoFilter}
                      onChange={(e) => setEstadoFilter(e.target.value)}
                    >
                      <option value="todos">Todos los estados</option>
                      {estadosDisponibles.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                    <button className="btn btn-info me-2" onClick={loadTodosLosUsuarios}>
                      <i className="fas fa-users me-1"></i>Todos
                    </button>
                    <button className="btn btn-primary" onClick={loadUsuarios}>
                      <i className="fas fa-sync-alt me-1"></i>Recargar
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
                    <>
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Nombre</th>
                              <th>Email</th>
                              <th>Teléfono</th>
                              <th>Rol</th>
                              <th>Estado</th>
                              <th>Fecha Ingreso</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usuarios.map(usuario => (
                              <tr key={usuario.id}>
                                <td>{usuario.id}</td>
                                <td>{usuario.nombre}</td>
                                <td>{usuario.email}</td>
                                <td>{usuario.telefono}</td>
                                <td>
                                  <span className={`badge ${getRolBadgeClass(usuario.rol)}`}>
                                    {usuario.rol}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${getEstadoBadgeClass(usuario.estado)}`}>
                                    {usuario.estado}
                                  </span>
                                </td>
                                <td>{usuario.fechaIngreso ? new Date(usuario.fechaIngreso).toLocaleDateString() : 'N/A'}</td>
                                <td>
                                  <div className="btn-group" role="group">
                                    <button 
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => setSelectedUsuario(usuario)}
                                    >
                                      <i className="fas fa-edit"></i>
                                    </button>
                                    <div className="btn-group" role="group">
                                      <button 
                                        className="btn btn-sm btn-outline-warning dropdown-toggle"
                                        data-bs-toggle="dropdown"
                                      >
                                        <i className="fas fa-exchange-alt"></i>
                                      </button>
                                      <ul className="dropdown-menu">
                                        {estadosDisponibles.map(estado => (
                                          <li key={estado}>
                                            <button 
                                              className="dropdown-item"
                                              onClick={() => cambiarEstadoUsuario(usuario.id, estado)}
                                            >
                                              {estado}
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <button 
                                      className="btn btn-sm btn-outline-info"
                                      onClick={() => resetearPassword(usuario.id)}
                                    >
                                      <i className="fas fa-key"></i>
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => eliminarUsuario(usuario.id)}
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Paginación */}
                      {totalPages > 1 && (
                        <nav className="mt-3">
                          <ul className="pagination justify-content-center">
                            <li className={`page-item ${pagination.page === 0 ? 'disabled' : ''}`}>
                              <button 
                                className="page-link" 
                                onClick={() => changePage(pagination.page - 1)}
                                disabled={pagination.page === 0}
                              >
                                Anterior
                              </button>
                            </li>
                            {[...Array(totalPages)].map((_, index) => (
                              <li key={index} className={`page-item ${pagination.page === index ? 'active' : ''}`}>
                                <button 
                                  className="page-link" 
                                  onClick={() => changePage(index)}
                                >
                                  {index + 1}
                                </button>
                              </li>
                            ))}
                            <li className={`page-item ${pagination.page === totalPages - 1 ? 'disabled' : ''}`}>
                              <button 
                                className="page-link" 
                                onClick={() => changePage(pagination.page + 1)}
                                disabled={pagination.page === totalPages - 1}
                              >
                                Siguiente
                              </button>
                            </li>
                          </ul>
                          <div className="text-center">
                            <small className="text-muted">
                              Mostrando {usuarios.length} de {totalElements} usuarios
                            </small>
                          </div>
                        </nav>
                      )}
                    </>
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
                  <h5>Crear Nuevo Usuario</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={(e) => { e.preventDefault(); crearUsuario(); }}>
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Nombre Completo *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.nombre}
                          onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Email *</label>
                        <input
                          type="email"
                          className="form-control"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={formData.telefono}
                          onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Fecha Ingreso</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.fechaIngreso}
                          onChange={(e) => setFormData({...formData, fechaIngreso: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Rol *</label>
                        <select
                          className="form-select"
                          value={formData.rol}
                          onChange={(e) => setFormData({...formData, rol: e.target.value})}
                          required
                        >
                          {rolesDisponibles.map(rol => (
                            <option key={rol} value={rol}>{rol}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Estado</label>
                        <select
                          className="form-select"
                          value={formData.estado}
                          onChange={(e) => setFormData({...formData, estado: e.target.value})}
                        >
                          {estadosDisponibles.map(estado => (
                            <option key={estado} value={estado}>{estado}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Contraseña *</label>
                        <input
                          type="password"
                          className="form-control"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Confirmar Contraseña *</label>
                        <input
                          type="password"
                          className="form-control"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="d-grid">
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Creando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save me-2"></i>
                            Crear Usuario
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

      case 'busqueda':
        return (
          <div className="row">
            <div className="col-md-8">
              <div className="card">
                <div className="card-header">
                  <h5>Búsqueda Universal de Usuarios</h5>
                </div>
                <div className="card-body">
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Buscar por ID, nombre o email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && buscarUsuario()}
                    />
                    <button className="btn btn-primary" onClick={buscarUsuario}>
                      <i className="fas fa-search me-1"></i>Buscar
                    </button>
                  </div>

                  {searchResult && (
                    <div className="card">
                      <div className="card-header">
                        <h6>Resultado de la búsqueda</h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <p><strong>ID:</strong> {searchResult.id}</p>
                            <p><strong>Nombre:</strong> {searchResult.nombre}</p>
                            <p><strong>Email:</strong> {searchResult.email}</p>
                          </div>
                          <div className="col-md-6">
                            <p><strong>Teléfono:</strong> {searchResult.telefono}</p>
                            <p><strong>Rol:</strong> 
                              <span className={`badge ${getRolBadgeClass(searchResult.rol)} ms-2`}>
                                {searchResult.rol}
                              </span>
                            </p>
                            <p><strong>Estado:</strong> 
                              <span className={`badge ${getEstadoBadgeClass(searchResult.estado)} ms-2`}>
                                {searchResult.estado}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <button 
                            className="btn btn-primary me-2"
                            onClick={() => setSelectedUsuario(searchResult)}
                          >
                            <i className="fas fa-edit me-1"></i>Editar
                          </button>
                          <button 
                            className="btn btn-warning me-2"
                            onClick={() => resetearPassword(searchResult.id)}
                          >
                            <i className="fas fa-key me-1"></i>Reset Password
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card">
                <div className="card-header">
                  <h6>Búsqueda por Empresa</h6>
                </div>
                <div className="card-body">
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ID de empresa..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          loadUsuariosPorEmpresa(e.target.value);
                        }
                      }}
                    />
                    <button 
                      className="btn btn-success"
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        loadUsuariosPorEmpresa(input.value);
                      }}
                    >
                      <i className="fas fa-search"></i>
                    </button>
                  </div>
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
    <div className="container-fluid">
      <div className="d-sm-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 text-gray-800">
          <i className="fas fa-users me-2"></i>
          Gestión de Usuarios - Todos los Endpoints
        </h1>
      </div>

      {/* Navegación por pestañas */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'lista' ? 'active' : ''}`}
            onClick={() => setActiveTab('lista')}
          >
            <i className="fas fa-list me-1"></i>Lista de Usuarios
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'crear' ? 'active' : ''}`}
            onClick={() => setActiveTab('crear')}
          >
            <i className="fas fa-plus me-1"></i>Crear Usuario
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'busqueda' ? 'active' : ''}`}
            onClick={() => setActiveTab('busqueda')}
          >
            <i className="fas fa-search me-1"></i>Búsquedas
          </button>
        </li>
      </ul>

      {/* Contenido de las pestañas */}
      {renderTabContent()}

      {/* Modal para editar usuario */}
      {selectedUsuario && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Editar Usuario</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setSelectedUsuario(null)}
                ></button>
              </div>
              <div className="modal-body">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  actualizarUsuario(selectedUsuario.id, selectedUsuario);
                }}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Nombre</label>
                      <input
                        type="text"
                        className="form-control"
                        value={selectedUsuario.nombre || ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, nombre: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={selectedUsuario.email || ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Teléfono</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={selectedUsuario.telefono || ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, telefono: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Rol</label>
                      <select
                        className="form-select"
                        value={selectedUsuario.rol || ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, rol: e.target.value})}
                      >
                        {rolesDisponibles.map(rol => (
                          <option key={rol} value={rol}>{rol}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Estado</label>
                      <select
                        className="form-select"
                        value={selectedUsuario.estado || ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, estado: e.target.value})}
                      >
                        {estadosDisponibles.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Fecha Ingreso</label>
                      <input
                        type="date"
                        className="form-control"
                        value={selectedUsuario.fechaIngreso ? selectedUsuario.fechaIngreso.split('T')[0] : ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, fechaIngreso: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="d-flex justify-content-end">
                    <button 
                      type="button" 
                      className="btn btn-secondary me-2"
                      onClick={() => setSelectedUsuario(null)}
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
  );
};

export default UsuariosPage;