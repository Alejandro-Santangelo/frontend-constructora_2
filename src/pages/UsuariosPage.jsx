import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useEmpresa } from '../EmpresaContext';
import { esSuperAdmin } from '../services/permisosService';

const UsuariosPage = ({ showNotification }) => {
  const { usuarioAutenticado } = useEmpresa();
  const isSuperAdmin = esSuperAdmin();
  
  // 🔐 Helper: verificar si el usuario actual es administrador
  // Roles administrativos: administrador, contratista
  const rolActual = usuarioAutenticado?.rol?.toLowerCase();
  const isAdmin = isSuperAdmin || rolActual === 'administrador' || rolActual === 'contratista';

  const [activeTab, setActiveTab] = useState('lista');
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [empresaId, setEmpresaId] = useState('1');
  const [rolFilter, setRolFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('todos');

  // Roles disponibles según sistema actualizado a español
  const rolesDisponibles = [
    'SUPER_ADMINISTRADOR',  // Super administrador global
    'contratista',          // Contratista (administrador de empresa constructora)
    'administrador',        // Administrador genérico
    'gerente',             // Gerente/Encargado
    'arquitecto',          // Arquitecto
    'ingeniero',           // Ingeniero
    'maestro_obra',        // Maestro de obra
    'empleado',            // Empleado general
    'usuario',             // Usuario estándar
    'visualizador'         // Solo visualización
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
    rol: 'usuario',
    pin: '',
    confirmPin: '',
    empresasPermitidas: [] // 🆕 Lista de empresas a las que tendrá acceso
  });

  // 🆕 Lista de empresas disponibles (para multi-select)
  const [empresasDisponibles, setEmpresasDisponibles] = useState([]);

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

  // 🔐 Estado para cambio de PIN
  const [pinData, setPinData] = useState({
    pinActual: '',
    pinNuevo: '',
    confirmarPinNuevo: ''
  });

  // 🔐 Efecto para cargar PIN actual cuando se selecciona un usuario
  useEffect(() => {
    if (selectedUsuario && selectedUsuario.passwordHash) {
      setPinData(prevState => ({
        ...prevState,
        pinActual: selectedUsuario.passwordHash
      }));
    } else {
      setPinData({
        pinActual: '',
        pinNuevo: '',
        confirmarPinNuevo: ''
      });
    }
  }, [selectedUsuario]);

  // 🆕 Cargar empresas disponibles si es SUPER_ADMIN
  useEffect(() => {
    if (isSuperAdmin) {
      const cargarEmpresas = async () => {
        try {
          const response = await api.get('/api/empresas');
          setEmpresasDisponibles(response || []);
        } catch (error) {
          console.error('Error cargando empresas:', error);
        }
      };
      cargarEmpresas();
    }
  }, [isSuperAdmin]);

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
      let usuariosList = data.content || data.resultado || [];

      console.log('🔐 UsuariosPage - usuarioAutenticado:', usuarioAutenticado);
      console.log('🔐 UsuariosPage - isSuperAdmin:', isSuperAdmin);
      console.log('🔐 UsuariosPage - rol:', usuarioAutenticado?.rol);
      console.log('🔐 UsuariosPage - usuariosList recibida:', usuariosList);

      // 🔐 CONTROL DE ACCESO POR ROL:
      // - SUPER_ADMINISTRADOR: ve TODOS los usuarios (sin filtrar)
      // - administrador/contratista: ve TODOS los usuarios de su empresa (sin filtrar)
      // - usuario/gerente/visualizador: solo ven SU PROPIO perfil
      
      if (!isSuperAdmin && !isAdmin && usuarioAutenticado) {
        // Usuario normal (usuario, gerente, visualizador) - solo ve su propio perfil
        const userIdToFilter = usuarioAutenticado.userId || usuarioAutenticado.id;
        usuariosList = usuariosList.filter(u => u.id == userIdToFilter);
        console.log('🔐 Usuario normal - filtrando solo su perfil. ID:', userIdToFilter);
      } else if (isAdmin || isSuperAdmin) {
        console.log('🔐 Admin o SuperAdmin - mostrando todos los usuarios');
      }

      setUsuarios(usuariosList);
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
    // Validar PIN
    if (!formData.pin || formData.pin.length !== 4) {
      showNotification('El PIN debe tener exactamente 4 dígitos', 'error');
      return;
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      showNotification('El PIN debe contener solo números', 'error');
      return;
    }

    if (formData.pin !== formData.confirmPin) {
      showNotification('Los PINs no coinciden', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // 🆕 SISTEMA MULTI-EMPRESA
      // Si es SUPER_ADMIN y tiene empresas seleccionadas, enviarlas como query parameter
      let url = `/api/usuarios`;
      if (isSuperAdmin && formData.empresasPermitidas && formData.empresasPermitidas.length > 0) {
        const empresasParam = formData.empresasPermitidas.join(',');
        url += `?empresasPermitidas=${empresasParam}`;
      }
      
      const response = await api.post(url, {
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol,
        passwordHash: formData.pin,  // El PIN se guarda en passwordHash
        activo: true
      });

      showNotification('Usuario creado exitosamente', 'success');
      setFormData({
        nombre: '',
        email: '',
        telefono: '',
        rol: 'usuario',
        pin: '',
        confirmPin: '',
        empresasPermitidas: []
      });
      loadUsuarios();
    } catch (error) {
      console.error('Error creando usuario:', error);
      // Extraer mensaje específico del backend
      const errorMsg = error.response?.data?.message || error.response?.data || error.message || 'Error creando usuario';
      showNotification(errorMsg, 'error');
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

  // 🔐 Cambiar PIN del usuario autenticado
  const cambiarPin = async () => {
    // Validaciones
    if (!pinData.pinActual || !pinData.pinNuevo || !pinData.confirmarPinNuevo) {
      showNotification('Complete todos los campos de PIN', 'warning');
      return;
    }

    if (pinData.pinNuevo !== pinData.confirmarPinNuevo) {
      showNotification('El PIN nuevo y la confirmación no coinciden', 'error');
      return;
    }

    if (!/^\d{4}$/.test(pinData.pinNuevo)) {
      showNotification('El PIN debe ser de 4 dígitos numéricos', 'error');
      return;
    }

    if (pinData.pinActual === pinData.pinNuevo) {
      showNotification('El PIN nuevo debe ser diferente al actual', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/api/auth/cambiar-pin/${selectedUsuario.id}`, {
        pinActual: pinData.pinActual,
        pinNuevo: pinData.pinNuevo
      });

      showNotification('PIN cambiado exitosamente', 'success');
      setPinData({ pinActual: '', pinNuevo: '', confirmarPinNuevo: '' });
    } catch (error) {
      console.error('Error cambiando PIN:', error);
      // Extraer mensaje específico del backend
      const errorMsg = error.response?.data?.message || error.response?.data || error.message || 'Error cambiando PIN';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 🔧 Función para cerrar modal y limpiar estados
  const cerrarModal = () => {
    setSelectedUsuario(null);
    setPinData({ pinActual: '', pinNuevo: '', confirmarPinNuevo: '' });
  };

  const getRolBadgeClass = (rol) => {
    switch (rol?.toLowerCase()) {
      case 'super_administrador': return 'bg-dark';
      case 'administrador': return 'bg-danger';
      case 'contratista': return 'bg-danger'; // Mismo nivel que administrador
      case 'gerente': return 'bg-primary';
      case 'arquitecto': return 'bg-info';
      case 'ingeniero': return 'bg-primary';
      case 'maestro_obra': return 'bg-warning';
      case 'empleado': return 'bg-success';
      case 'usuario': return 'bg-success';
      case 'visualizador': return 'bg-secondary';
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
                    {/* 🔐 Filtros solo visibles para SUPER_ADMIN */}
                    {isSuperAdmin && (
                      <>
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
                      </>
                    )}
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
                                      title="Editar usuario"
                                    >
                                      <i className="fas fa-edit"></i>
                                    </button>
                                    {/* 🔐 Botones de administración solo para SUPER_ADMIN y admin */}
                                    {isAdmin && (
                                      <>
                                        <div className="btn-group" role="group">
                                          <button
                                            className="btn btn-sm btn-outline-warning dropdown-toggle"
                                            data-bs-toggle="dropdown"
                                            title="Cambiar estado"
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
                                          title="Resetear contraseña"
                                        >
                                          <i className="fas fa-key"></i>
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={() => eliminarUsuario(usuario.id)}
                                          title="Eliminar usuario"
                                        >
                                          <i className="fas fa-trash"></i>
                                        </button>
                                      </>
                                    )}
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
                      <div className="col-md-12 mb-3">
                        <label className="form-label">Rol *</label>
                        <select
                          className="form-select"
                          value={formData.rol}
                          onChange={(e) => setFormData({...formData, rol: e.target.value})}
                          required
                        >
                          {rolesDisponibles.map(rol => (
                            <option key={rol} value={rol}>
                              {rol.charAt(0).toUpperCase() + rol.slice(1)}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted">
                          El rol determina los permisos del usuario en la empresa
                        </small>
                      </div>
                    </div>

                    {/* 🆕 SISTEMA MULTI-EMPRESA: Solo visible para SUPER_ADMIN */}
                    {isSuperAdmin && (
                      <div className="row">
                        <div className="col-md-12 mb-3">
                          <label className="form-label">
                            Empresas Permitidas
                            <i className="fas fa-info-circle ms-2 text-info" 
                               title="Selecciona las empresas a las que este usuario tendrá acceso"></i>
                          </label>
                          <select
                            className="form-select"
                            multiple
                            size="5"
                            value={formData.empresasPermitidas}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, option => Number(option.value));
                              setFormData({...formData, empresasPermitidas: selected});
                            }}
                          >
                            {empresasDisponibles.map(empresa => (
                              <option key={empresa.id} value={empresa.id}>
                                {empresa.nombreEmpresa} (ID: {empresa.id})
                              </option>
                            ))}
                          </select>
                          <small className="text-muted">
                            Mantén presionado Ctrl (Cmd en Mac) para seleccionar múltiples empresas.
                            {formData.empresasPermitidas.length > 0 && (
                              <span className="text-success ms-2">
                                <i className="fas fa-check-circle"></i> {formData.empresasPermitidas.length} empresa(s) seleccionada(s)
                              </span>
                            )}
                          </small>
                        </div>
                      </div>
                    )}

                    <div className="alert alert-info mb-3">
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>PIN de acceso:</strong> El usuario usar\u00e1 este PIN de 4 d\u00edgitos para iniciar sesi\u00f3n
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">PIN (4 d\u00edgitos) *</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="****"
                          maxLength="4"
                          value={formData.pin}
                          onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\\D/g, '')})}
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Confirmar PIN *</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="****"
                          maxLength="4"
                          value={formData.confirmPin}
                          onChange={(e) => setFormData({...formData, confirmPin: e.target.value.replace(/\\D/g, '')})}
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
        {/* 🔐 Tab "Crear Usuario" solo visible para SUPER_ADMIN y admin */}
        {isAdmin && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'crear' ? 'active' : ''}`}
              onClick={() => setActiveTab('crear')}
            >
              <i className="fas fa-plus me-1"></i>Crear Usuario
            </button>
          </li>
        )}
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
                  onClick={cerrarModal}
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
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Rol</label>
                      <select
                        className="form-select"
                        value={selectedUsuario.rol || ''}
                        onChange={(e) => setSelectedUsuario({...selectedUsuario, rol: e.target.value})}
                        disabled={!isAdmin}
                      >
                        {rolesDisponibles.map(rol => (
                          <option key={rol} value={rol}>
                            {rol.charAt(0).toUpperCase() + rol.slice(1)}
                          </option>
                        ))}
                      </select>
                      {!isAdmin && (
                        <small className="text-muted">Solo administradores pueden cambiar el rol</small>
                      )}
                    </div>
                  </div>

                  <div className="d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-secondary me-2"
                      onClick={cerrarModal}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <i className="fas fa-save me-1"></i>Guardar Cambios
                    </button>
                  </div>
                </form>

                {/* 🔐 Sección de Cambio de PIN - Visible para el propio usuario O para SUPER_ADMIN */}
                {(selectedUsuario.id === (usuarioAutenticado?.userId || usuarioAutenticado?.id) || isSuperAdmin) && (
                  <>
                    <hr className="my-4" />
                    <h6 className="mb-3"><i className="fas fa-key me-2"></i>Cambiar PIN de Acceso</h6>
                    <div className="alert alert-info">
                      <i className="fas fa-info-circle me-2"></i>
                      El PIN debe ser de 4 dígitos numéricos. Lo usarás para iniciar sesión.
                    </div>
                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <label className="form-label">PIN Actual *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="****"
                          maxLength="4"
                          value={pinData.pinActual}
                          onChange={(e) => setPinData({...pinData, pinActual: e.target.value.replace(/\D/g, '')})}
                          readOnly={isSuperAdmin && selectedUsuario.id !== (usuarioAutenticado?.userId || usuarioAutenticado?.id)}
                        />
                        <small className="text-muted">PIN actualmente configurado. Visible para edición.</small>
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">PIN Nuevo *</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="****"
                          maxLength="4"
                          value={pinData.pinNuevo}
                          onChange={(e) => setPinData({...pinData, pinNuevo: e.target.value.replace(/\D/g, '')})}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Confirmar PIN Nuevo *</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="****"
                          maxLength="4"
                          value={pinData.confirmarPinNuevo}
                          onChange={(e) => setPinData({...pinData, confirmarPinNuevo: e.target.value.replace(/\D/g, '')})}
                        />
                      </div>
                    </div>
                    <div className="d-flex justify-content-end">
                      <button
                        type="button"
                        className="btn btn-warning"
                        onClick={cambiarPin}
                        disabled={loading}
                      >
                        <i className="fas fa-key me-1"></i>
                        {loading ? 'Cambiando...' : 'Cambiar PIN'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
