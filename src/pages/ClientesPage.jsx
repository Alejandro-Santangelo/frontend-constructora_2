import React, { useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import { useSelector, useDispatch } from 'react-redux';
import { getCurrentTenant } from '../services/api';
import {
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  searchClientes,
  setActiveTab,
  setSelectedCliente,
  clearSearchResult,
  clearError,
  updatePagination
} from '../store/slices/clientesSlice';
import { fetchEmpresasActivas } from '../store/slices/empresasSlice';

const ClientesPage = ({ showNotification }) => {
  const dispatch = useDispatch();
  
  // Redux state
  const {
    clientes,
    loading,
    searchResult,
    activeTab,
    pagination,
    error,
    creating,
    updating,
    deleting
  } = useSelector(state => state.clientes);
  
  const { empresas } = useSelector(state => state.empresas);
  const empresasActivas = useSelector(state => state.empresas.empresasActivas);
  
  // Local state para formularios y búsqueda
  const [searchQuery, setSearchQuery] = React.useState('');
  const [clienteParaEditar, setClienteParaEditar] = React.useState(null);
  const [selectedCliente, setSelectedCliente] = React.useState(null); // Cambiado a useState local
  const { empresaSeleccionada } = useEmpresa();
  const empresaId = empresaSeleccionada ? empresaSeleccionada.id : '';
  
  // DEBUG: Ver valor de selectedCliente
  React.useEffect(() => {
    console.log('🔍 VALOR DE selectedCliente:', selectedCliente);
  }, [selectedCliente]);
  
  const [formData, setFormData] = React.useState({
    nombre: '',
    email: '',
    telefono: '',
    cuitCuil: '',
    direccion: '',
    empresaId: empresaId
  });

  // Definir botones de acción para el sidebar
  const actionButtons = [
    { id: 'lista', label: 'Lista de Clientes', icon: 'fas fa-list' },
    { id: 'buscar', label: 'Búsqueda Universal', icon: 'fas fa-search' }
  ];

  // Botones de acción cuando hay un cliente seleccionado
  const selectedItemActions = selectedCliente ? [
    { 
      id: 'editar', 
      label: 'Editar Cliente', 
      icon: 'fas fa-edit',
      color: '#fd7e14',
      onClick: () => setClienteParaEditar(selectedCliente)
    },
    {
      id: 'eliminar',
      label: 'Eliminar',
      icon: 'fas fa-trash',
      color: '#dc3545',
      onClick: () => eliminarCliente(selectedCliente.id || selectedCliente.id_cliente)
    }
  ] : [];

  useEffect(() => {
    dispatch(fetchClientes({ empresaId, ...pagination }));
    dispatch(fetchEmpresasActivas());
    setFormData(formData => ({ ...formData, empresaId }));
  }, [dispatch, empresaId, pagination]);

  // NOTA: Estos métodos están comentados porque usan fetch() directo y funciones de estado que no existen
  // Si se necesitan, deben reescribirse usando Redux thunks
  /*
  const loadTodosLosClientes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clientes/todos?empresaId=${empresaId}`);
      const data = await response.json();
      setClientes(data || []);
      showNotification('Todos los clientes cargados', 'success');
    } catch (error) {
      console.error('Error cargando todos los clientes:', error);
      showNotification('Error cargando todos los clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadClientesTodasEmpresas = async () => {
    try {
      const response = await fetch('/api/clientes/empresas');
      const data = await response.json();
      console.log('Clientes de todas las empresas:', data);
      showNotification('Clientes de todas las empresas cargados', 'success');
    } catch (error) {
      console.error('Error cargando clientes de todas las empresas:', error);
      showNotification('Error cargando clientes de todas las empresas', 'error');
    } finally {
      setLoading(false);
    }
  };
  */

  const buscarCliente = async () => {
    if (!searchQuery.trim()) {
      showNotification('Ingrese un término de búsqueda', 'warning');
      return;
    }
    
    try {
      const result = await dispatch(searchClientes({ 
        termino: searchQuery, 
        empresaId 
      })).unwrap();
      showNotification('Búsqueda realizada', 'success');
    } catch (error) {
      console.error('Error en búsqueda:', error);
      showNotification('Error en búsqueda', 'error');
    }
  };

  const crearCliente = async () => {
    try {
      console.log('FormData completo:', formData);
      
      // Separar empresaId del resto de datos del cliente
      const { empresaId: formEmpresaId, ...clienteData } = formData;
      
      console.log('EmpresaId:', formEmpresaId);
      console.log('ClienteData:', clienteData);
      
      // Validar que empresaId no esté vacío
      if (!formEmpresaId) {
        throw new Error('Debe seleccionar una empresa');
      }
      
      const result = await dispatch(createCliente({ 
        empresaId: formEmpresaId, 
        clienteData 
      })).unwrap();
      
      console.log('Cliente creado:', result);
      showNotification('Cliente creado exitosamente', 'success');
      setFormData({
        nombre: '',
          email: '',
          telefono: '',
          cuitCuil: '',
          direccion: '',
          empresaId: ''
        });
        // Refrescar la lista
        dispatch(fetchClientes({ empresaId, ...pagination }));
    } catch (error) {
      console.error('Error creando cliente:', error);
      showNotification('Error creando cliente', 'error');
    }
  };

  const actualizarCliente = async (id, data) => {
    try {
      console.log('Actualizando cliente:', { id, data });
      
      // Limpiar los datos - quitar campos que no deben enviarse al backend
      const { empresas, fechaCreacion, ...clienteData } = data;
      console.log('Datos limpios a enviar:', clienteData);
      
      const result = await dispatch(updateCliente({ 
        id, 
        clienteData 
      })).unwrap();
      
      console.log('Cliente actualizado exitosamente:', result);
      showNotification('Cliente actualizado exitosamente', 'success');
      setClienteParaEditar(null);
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      showNotification(`Error actualizando cliente: ${error.message}`, 'error');
    }
  };

  const eliminarCliente = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este cliente?')) return;

    try {
      await dispatch(deleteCliente({ id, empresaId })).unwrap();
      showNotification('Cliente eliminado exitosamente', 'success');
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      showNotification(`Error eliminando cliente: ${error.message}`, 'error');
    }
  };

  // Búsqueda con Redux
  const buscarClientes = async () => {
    if (!searchQuery.trim()) {
      showNotification('Ingrese un término de búsqueda', 'warning');
      return;
    }
    
    try {
      const result = await dispatch(searchClientes({ 
        termino: searchQuery, 
        empresaId 
      })).unwrap();
      showNotification('Búsqueda realizada', 'success');
    } catch (error) {
      console.error('Error en búsqueda:', error);
      showNotification('Error en búsqueda', 'error');
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
                  <h5>Lista de Clientes</h5>
                  <div>
                    <input
                      type="text"
                      className="form-control d-inline-block me-2"
                      style={{width: 'auto', maxWidth: 200}}
                      value={empresaSeleccionada ? (empresaSeleccionada.nombreEmpresa || empresaSeleccionada.nombre || empresaSeleccionada.razonSocial || empresaSeleccionada.cuit || empresaSeleccionada.id) : ''}
                      disabled
                    />
                    {/* Botones comentados - funcionalidad por implementar con Redux
                    <button className="btn btn-info me-2" onClick={loadTodosLosClientes}>
                      <i className="fas fa-list me-1"></i>Todos (Sin Paginación)
                    </button>
                    <button className="btn btn-warning me-2" onClick={loadClientesTodasEmpresas}>
                      <i className="fas fa-building me-1"></i>Todas las Empresas
                    </button>
                    */}
                    <button className="btn btn-primary" onClick={() => dispatch(fetchClientes({ empresaId, ...pagination }))}>
                      <i className="fas fa-sync-alt me-1"></i>Recargar
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {/* Controles de paginación */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="d-flex align-items-center">
                        <label className="me-2">Tamaño de página:</label>
                        <select 
                          className="form-select" 
                          style={{width: 'auto'}}
                          value={pagination.size}
                          onChange={(e) => dispatch(updatePagination({...pagination, size: parseInt(e.target.value), page: 0}))}
                        >
                          <option value="10">10</option>
                          <option value="20">20</option>
                          <option value="50">50</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex align-items-center">
                        <label className="me-2">Ordenar por:</label>
                        <select 
                          className="form-select me-2" 
                          style={{width: 'auto'}}
                          value={pagination.sort}
                          onChange={(e) => dispatch(updatePagination({...pagination, sort: e.target.value}))}
                        >
                          <option value="id">ID</option>
                          <option value="nombre">Nombre</option>
                          <option value="cuitCuil">CUIT/CUIL</option>
                          <option value="fechaCreacion">Fecha Creación</option>
                        </select>
                        <select 
                          className="form-select" 
                          style={{width: 'auto'}}
                          value={pagination.direction}
                          onChange={(e) => dispatch(updatePagination({...pagination, direction: e.target.value}))}
                        >
                          <option value="ASC">Ascendente</option>
                          <option value="DESC">Descendente</option>
                        </select>
                      </div>
                    </div>
                  </div>

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
                            <th>CUIT/CUIL</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Dirección</th>
                            <th>Empresa</th>
                            <th>Fecha Creación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientes.map(cliente => {
                            const clienteId = cliente.id || cliente.id_cliente;
                            const selectedId = selectedCliente?.id || selectedCliente?.id_cliente;
                            const isSelected = selectedCliente && clienteId && selectedId && clienteId === selectedId;
                            
                            return (
                              <tr 
                                key={clienteId}
                                onClick={() => {
                                  // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                                  if (isSelected) {
                                    setSelectedCliente(null);
                                  } else {
                                    setSelectedCliente(cliente);
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
                                    <span>{clienteId}</span>
                                  </div>
                                </td>
                              <td>{cliente.nombre}</td>
                              <td>{cliente.cuitCuil}</td>
                              <td>{cliente.email}</td>
                              <td>{cliente.telefono}</td>
                              <td>{cliente.direccion}</td>
                              <td>
                                {cliente.empresas && cliente.empresas.length > 0 
                                  ? cliente.empresas.map(emp => emp.nombre || emp.razonSocial).join(', ')
                                  : 'Sin empresa'
                                }
                              </td>
                              <td>{cliente.fechaCreacion ? new Date(cliente.fechaCreacion).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Controles de navegación de páginas */}
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <button 
                      className="btn btn-outline-primary"
                      disabled={pagination.page === 0}
                      onClick={() => dispatch(updatePagination({...pagination, page: pagination.page - 1}))}
                    >
                      <i className="fas fa-chevron-left me-1"></i>Anterior
                    </button>
                    <span>Página {pagination.page + 1}</span>
                    <button 
                      className="btn btn-outline-primary"
                      onClick={() => dispatch(updatePagination({...pagination, page: pagination.page + 1}))}
                    >
                      Siguiente<i className="fas fa-chevron-right ms-1"></i>
                    </button>
                  </div>
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
                  <h5>Búsqueda de Clientes</h5>
                  <small className="text-muted">Buscar por ID, CUIT/CUIL o nombre</small>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Empresa</label>
                    <input
                      type="text"
                      className="form-control"
                      value={empresaSeleccionada ? (empresaSeleccionada.nombreEmpresa || empresaSeleccionada.nombre || empresaSeleccionada.razonSocial || empresaSeleccionada.cuit || empresaSeleccionada.id) : ''}
                      disabled
                    />
                  </div>
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ingrese ID, CUIT/CUIL o nombre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && buscarCliente()}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={buscarCliente}
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
                      <li><strong>Por CUIT/CUIL:</strong> 20-12345678-9</li>
                      <li><strong>Por nombre:</strong> Juan Pérez</li>
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
                      <h6><i className="fas fa-user me-2"></i>{searchResult.nombre}</h6>
                      <hr />
                      <p><strong>ID:</strong> {searchResult.id}</p>
                      <p><strong>CUIT/CUIL:</strong> {searchResult.cuitCuil}</p>
                      <p><strong>Email:</strong> {searchResult.email}</p>
                      <p><strong>Teléfono:</strong> {searchResult.telefono}</p>
                      <p><strong>Dirección:</strong> {searchResult.direccion}</p>
                      <p><strong>Fecha Creación:</strong> {searchResult.fechaCreacion ? new Date(searchResult.fechaCreacion).toLocaleString() : 'N/A'}</p>
                    </div>
                  ) : (
                    <div className="text-muted text-center">
                      <i className="fas fa-search fa-3x mb-3"></i>
                      <p>Ingrese un término de búsqueda para encontrar clientes</p>
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
                  <h5>Crear Nuevo Cliente</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={(e) => { e.preventDefault(); crearCliente(); }}>
                    <div className="mb-3">
                      <label className="form-label">Empresa *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={empresaSeleccionada ? (empresaSeleccionada.nombreEmpresa || empresaSeleccionada.nombre || empresaSeleccionada.razonSocial || empresaSeleccionada.cuit || empresaSeleccionada.id) : ''}
                        disabled
                        required
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Nombre *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.nombre}
                          onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">CUIT/CUIL</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="XX-XXXXXXXX-X"
                          value={formData.cuitCuil}
                          onChange={(e) => setFormData({...formData, cuitCuil: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.telefono}
                          onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Dirección</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.direccion}
                        onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                      />
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
                            Crear Cliente
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

      default:
        return <div>Sección no encontrada</div>;
    }
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar con botones de acción */}
      <div className="bg-primary text-white" style={{ width: '260px', minHeight: '100vh', padding: '20px' }}>
        <h5 className="mb-4"><i className="fas fa-users me-2"></i>Clientes</h5>
        <div className="d-flex flex-column gap-2">
          <button
            className="btn btn-lg btn-success text-start"
            onClick={() => dispatch(setActiveTab('crear'))}
          >
            <i className="fas fa-plus me-2"></i>Nuevo Cliente
          </button>
          <button
            className="btn btn-lg btn-info text-start"
            onClick={() => dispatch(setActiveTab('lista'))}
          >
            <i className="fas fa-list me-2"></i>Lista de Clientes
          </button>
          <button
            className="btn btn-lg btn-warning text-start"
            onClick={() => dispatch(setActiveTab('buscar'))}
          >
            <i className="fas fa-search me-2"></i>Búsqueda Universal
          </button>
          <>
            <hr className="border-secondary my-3" />
            <small className="text-muted">Acciones del elemento</small>
            {selectedCliente ? (
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
                  <i className="fas fa-edit me-2"></i>Editar Cliente
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
        className="flex-grow-1" 
        style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}
        onClick={() => setSelectedCliente(null)}
      >
        <div className="p-4">
          <div className="container-fluid">
            <div className="d-sm-flex align-items-center justify-content-between mb-4">
              <h1 className="h3 mb-0 text-gray-800">
                <i className="fas fa-users me-2"></i>
                Gestión de Clientes
              </h1>
            </div>

            {/* Contenido de las pestañas */}
            <div>
              {renderTabContent()}

            {/* Modal para editar cliente */}
            {clienteParaEditar && (
              <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                <div className="modal-dialog modal-lg">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Editar Cliente</h5>
                      <button 
                        type="button" 
                        className="btn-close"
                        onClick={() => setClienteParaEditar(null)}
                      ></button>
                    </div>
                    <div className="modal-body" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        actualizarCliente(clienteParaEditar.id || clienteParaEditar.id_cliente, clienteParaEditar);
                      }}>
                        <div className="mb-3">
                          <label className="form-label">Nombre</label>
                          <input
                            type="text"
                            className="form-control"
                            value={clienteParaEditar.nombre || ''}
                            onChange={(e) => setClienteParaEditar({...clienteParaEditar, nombre: e.target.value})}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">CUIT/CUIL</label>
                          <input
                            type="text"
                            className="form-control"
                            value={clienteParaEditar.cuitCuil || ''}
                            onChange={(e) => setClienteParaEditar({...clienteParaEditar, cuitCuil: e.target.value})}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Empresa</label>
                          <input
                            type="text"
                            className="form-control"
                            value={empresaSeleccionada ? (empresaSeleccionada.nombreEmpresa || empresaSeleccionada.nombre || empresaSeleccionada.razonSocial || empresaSeleccionada.cuit || empresaSeleccionada.id) : ''}
                            disabled
                          />
                        </div>
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Email</label>
                            <input
                              type="email"
                              className="form-control"
                              value={clienteParaEditar.email || ''}
                              onChange={(e) => setClienteParaEditar({...clienteParaEditar, email: e.target.value})}
                            />
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Teléfono</label>
                            <input
                              type="text"
                              className="form-control"
                              value={clienteParaEditar.telefono || ''}
                              onChange={(e) => setClienteParaEditar({...clienteParaEditar, telefono: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Dirección</label>
                          <input
                            type="text"
                            className="form-control"
                            value={clienteParaEditar.direccion || ''}
                            onChange={(e) => setClienteParaEditar({...clienteParaEditar, direccion: e.target.value})}
                          />
                        </div>
                      </form>
                    </div>
                    <div className="modal-footer">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setClienteParaEditar(null)}
                      >
                        <i className="fas fa-times me-1"></i>Cancelar
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={() => {
                          actualizarCliente(clienteParaEditar.id || clienteParaEditar.id_cliente, clienteParaEditar);
                        }}
                      >
                        <i className="fas fa-save me-1"></i>Guardar Cambios
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientesPage;