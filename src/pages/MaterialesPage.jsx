import React, { useState, useEffect, useContext } from 'react';
import { useEmpresa } from '../EmpresaContext';
import { SidebarContext } from '../App';
import api from '../services/api';
import catalogoMaterialesUpdateService from '../services/catalogoMaterialesUpdateService';

const MaterialesPage = () => {
  const { empresaSeleccionada } = useEmpresa();
  const { setMaterialesControls } = useContext(SidebarContext) || {};

  // Estados principales
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);

  // Estados para modales
  const [mostrarModalPrecioTodos, setMostrarModalPrecioTodos] = useState(false);
  const [mostrarModalPrecioSeleccionados, setMostrarModalPrecioSeleccionados] = useState(false);
  const [mostrarModalPrecioUno, setMostrarModalPrecioUno] = useState(false);
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);

  const [materialSeleccionado, setMaterialSeleccionado] = useState(null);
  const [porcentaje, setPorcentaje] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria: '',
    unidadMedida: '',
    precioUnitario: '',
    stock: ''
  });

  // Cargar materiales
  useEffect(() => {
    if (empresaSeleccionada?.id) {
      cargarMateriales();
    }
  }, [empresaSeleccionada]);

  // Configurar controles del sidebar
  useEffect(() => {
    if (setMaterialesControls) {
      setMaterialesControls({
        handleNuevo: abrirModalCrear,
        handleAjustarTodos: () => setMostrarModalPrecioTodos(true),
        handleAjustarSeleccionados: () => {
          if (seleccionados.length > 0) {
            setMostrarModalPrecioSeleccionados(true);
          }
        },
        seleccionadosCount: seleccionados.length
      });
    }

    // Limpiar controles cuando el componente se desmonta
    return () => {
      if (setMaterialesControls) {
        setMaterialesControls(null);
      }
    };
  }, [setMaterialesControls, seleccionados.length]);

  const cargarMateriales = async () => {
    if (!empresaSeleccionada?.id) return;

    setLoading(true);
    try {
      const response = await api.materiales.getAll(empresaSeleccionada.id);
      // api.materiales.getAll devuelve el array directamente, NO { data: [...] }
      setMateriales(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error cargando materiales:', error);
      mostrarNotificacion('Error al cargar materiales', 'error');
      setMateriales([]);
    } finally {
      setLoading(false);
    }
  };

  const mostrarNotificacion = (mensaje, tipo = 'success') => {
    const alertClass = tipo === 'success' ? 'alert-success' : 'alert-danger';
    const div = document.createElement('div');
    div.className = `alert ${alertClass} position-fixed top-0 start-50 translate-middle-x mt-3`;
    div.style.zIndex = '9999';
    div.textContent = mensaje;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  };

  // Filtrado
  const materialesFiltrados = materiales.filter(mat =>
    mat.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mat.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers de selección
  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSeleccionTodos = () => {
    if (seleccionados.length === materialesFiltrados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(materialesFiltrados.map(m => m.id));
    }
  };

  // CRUD Handlers
  const abrirModalCrear = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      categoria: '',
      unidadMedida: '',
      precioUnitario: '',
      stock: ''
    });
    setMostrarModalCrear(true);
  };

  const abrirModalEditar = (material) => {
    setMaterialSeleccionado(material);
    setFormData({
      nombre: material.nombre || '',
      descripcion: material.descripcion || '',
      categoria: material.categoria || '',
      unidadMedida: material.unidadMedida || '',
      precioUnitario: material.precioUnitario || '',
      stock: material.stock || ''
    });
    setMostrarModalEditar(true);
  };

  const abrirModalEliminar = (material) => {
    setMaterialSeleccionado(material);
    setMostrarModalEliminar(true);
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      mostrarNotificacion('El nombre es obligatorio', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.materiales.create({
        ...formData,
        precioUnitario: formData.precioUnitario ? parseFloat(formData.precioUnitario) : null,
        stock: formData.stock ? parseFloat(formData.stock) : null
      });
      mostrarNotificacion('Material creado exitosamente');
      setMostrarModalCrear(false);
      cargarMateriales();
    } catch (error) {
      console.error('Error creando material:', error);
      mostrarNotificacion('Error al crear material', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActualizar = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      mostrarNotificacion('El nombre es obligatorio', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.materiales.update(materialSeleccionado.id, {
        ...formData,
        precioUnitario: formData.precioUnitario ? parseFloat(formData.precioUnitario) : null,
        stock: formData.stock ? parseFloat(formData.stock) : null
      });
      mostrarNotificacion('Material actualizado exitosamente');
      setMostrarModalEditar(false);
      cargarMateriales();
    } catch (error) {
      console.error('Error actualizando material:', error);
      mostrarNotificacion('Error al actualizar material', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async () => {
    if (!materialSeleccionado) return;

    setLoading(true);
    try {
      await api.materiales.delete(materialSeleccionado.id);
      mostrarNotificacion('Material eliminado exitosamente');
      setMostrarModalEliminar(false);
      setMaterialSeleccionado(null);
      cargarMateriales();
    } catch (error) {
      console.error('Error eliminando material:', error);
      mostrarNotificacion('Error al eliminar material', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handlers de actualización de precios
  const validarPorcentajeExtremo = (valor) => {
    const num = parseFloat(valor);
    return Math.abs(num) > 50;
  };

  const handleActualizarPrecioTodos = async () => {
    const porcentajeNum = parseFloat(porcentaje);
    if (isNaN(porcentajeNum)) {
      mostrarNotificacion('Ingrese un porcentaje válido', 'error');
      return;
    }

    if (validarPorcentajeExtremo(porcentajeNum) && !mostrarConfirmacion) {
      setMostrarConfirmacion(true);
      return;
    }

    setLoading(true);
    try {
      await catalogoMaterialesUpdateService.actualizarPrecioTodos(porcentajeNum, empresaSeleccionada.id);
      mostrarNotificacion(`✅ Precios actualizados para todos los materiales (${porcentajeNum >= 0 ? '+' : ''}${porcentajeNum}%)`);
      setMostrarModalPrecioTodos(false);
      setPorcentaje('');
      setMostrarConfirmacion(false);
      cargarMateriales();
    } catch (error) {
      console.error('Error actualizando precios:', error);
      mostrarNotificacion('Error al actualizar precios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActualizarPrecioSeleccionados = async () => {
    const porcentajeNum = parseFloat(porcentaje);
    if (isNaN(porcentajeNum)) {
      mostrarNotificacion('Ingrese un porcentaje válido', 'error');
      return;
    }

    if (validarPorcentajeExtremo(porcentajeNum) && !mostrarConfirmacion) {
      setMostrarConfirmacion(true);
      return;
    }

    setLoading(true);
    try {
      await catalogoMaterialesUpdateService.actualizarPrecioVarios(seleccionados, porcentajeNum, empresaSeleccionada.id);
      mostrarNotificacion(`✅ Precios actualizados para ${seleccionados.length} materiales (${porcentajeNum >= 0 ? '+' : ''}${porcentajeNum}%)`);
      setMostrarModalPrecioSeleccionados(false);
      setPorcentaje('');
      setMostrarConfirmacion(false);
      setSeleccionados([]);
      cargarMateriales();
    } catch (error) {
      console.error('Error actualizando precios:', error);
      mostrarNotificacion('Error al actualizar precios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActualizarPrecioUno = async () => {
    const porcentajeNum = parseFloat(porcentaje);
    if (isNaN(porcentajeNum)) {
      mostrarNotificacion('Ingrese un porcentaje válido', 'error');
      return;
    }

    if (validarPorcentajeExtremo(porcentajeNum) && !mostrarConfirmacion) {
      setMostrarConfirmacion(true);
      return;
    }

    setLoading(true);
    try {
      await catalogoMaterialesUpdateService.actualizarPrecioUno(materialSeleccionado.id, porcentajeNum, empresaSeleccionada.id);
      mostrarNotificacion(`✅ Precio actualizado (${porcentajeNum >= 0 ? '+' : ''}${porcentajeNum}%)`);
      setMostrarModalPrecioUno(false);
      setPorcentaje('');
      setMostrarConfirmacion(false);
      setMaterialSeleccionado(null);
      cargarMateriales();
    } catch (error) {
      console.error('Error actualizando precio:', error);
      mostrarNotificacion('Error al actualizar precio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calcularNuevoPrecio = (precioActual, porcentaje) => {
    const num = parseFloat(porcentaje);
    if (isNaN(num) || !precioActual) return null;
    return (parseFloat(precioActual) * (1 + num / 100)).toFixed(2);
  };

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <i className="fas fa-boxes me-2"></i>
          Materiales
        </h2>
      </div>

      {/* Búsqueda */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-10">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setSearchTerm('')}
              >
                <i className="fas fa-times me-2"></i>
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : materialesFiltrados.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="fas fa-inbox fa-3x mb-3"></i>
              <p>No hay materiales para mostrar</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={seleccionados.length === materialesFiltrados.length && materialesFiltrados.length > 0}
                        onChange={toggleSeleccionTodos}
                      />
                    </th>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Unidad</th>
                    <th>Precio Unitario</th>
                    <th>Stock</th>
                    <th style={{ width: '150px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {materialesFiltrados.map(material => (
                    <tr key={material.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(material.id)}
                          onChange={() => toggleSeleccion(material.id)}
                        />
                      </td>
                      <td>{material.id}</td>
                      <td className="fw-bold">{material.nombre}</td>
                      <td>
                        <small className="text-muted">
                          {material.descripcion || '-'}
                        </small>
                      </td>
                      <td>{material.unidadMedida || '-'}</td>
                      <td>
                        {material.precioUnitario != null ? (
                          <span className="fw-bold text-success">
                            ${parseFloat(material.precioUnitario).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{material.stock || '-'}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-warning"
                            onClick={() => {
                              setMaterialSeleccionado(material);
                              setMostrarModalPrecioUno(true);
                            }}
                            title="Ajustar precio"
                          >
                            <i className="fas fa-percentage"></i>
                          </button>
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => abrirModalEditar(material)}
                            title="Editar"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => abrirModalEliminar(material)}
                            title="Eliminar"
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
          )}
        </div>
      </div>

      {/* MODALES */}
      {/* Modal Crear */}
      {mostrarModalCrear && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-plus me-2"></i>
                  Nuevo Material
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalCrear(false)}
                ></button>
              </div>
              <form onSubmit={handleCrear}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">
                      Nombre <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Unidad de Medida</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.unidadMedida}
                      onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                      placeholder="m³, kg, litros, etc."
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Precio Unitario</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.precioUnitario}
                      onChange={(e) => setFormData({ ...formData, precioUnitario: e.target.value })}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMostrarModalCrear(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {mostrarModalEditar && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="fas fa-edit me-2"></i>
                  Editar Material
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setMostrarModalEditar(false)}
                ></button>
              </div>
              <form onSubmit={handleActualizar}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">
                      Nombre <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Unidad de Medida</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.unidadMedida}
                      onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Precio Unitario</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.precioUnitario}
                      onChange={(e) => setFormData({ ...formData, precioUnitario: e.target.value })}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMostrarModalEditar(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-warning" disabled={loading}>
                    {loading ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {mostrarModalEliminar && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="fas fa-trash me-2"></i>
                  Confirmar Eliminación
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalEliminar(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>¿Está seguro de eliminar el material?</p>
                <div className="alert alert-warning">
                  <strong>{materialSeleccionado?.nombre}</strong>
                </div>
                <p className="text-muted">Esta acción no se puede deshacer.</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalEliminar(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleEliminar}
                  disabled={loading}
                >
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Precio Todos */}
      {mostrarModalPrecioTodos && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="fas fa-percentage me-2"></i>
                  Ajustar Precios - Todos
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalPrecioTodos(false);
                    setMostrarConfirmacion(false);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Ingrese el porcentaje de incremento/decremento. Use números positivos para aumentar y negativos para reducir.
                  <br />
                  <strong>Ejemplos:</strong> 10 = +10%, -5 = -5%
                </div>

                <div className="mb-3">
                  <label className="form-label">Porcentaje (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(e.target.value)}
                    placeholder="Ej: 10 o -5"
                    step="0.01"
                  />
                </div>

                {porcentaje && (
                  <div className={`alert ${parseFloat(porcentaje) >= 0 ? 'alert-success' : 'alert-danger'}`}>
                    <strong>Preview:</strong> Se aplicará{' '}
                    <strong>{parseFloat(porcentaje) >= 0 ? '+' : ''}{porcentaje}%</strong> a{' '}
                    <strong>{materiales.length}</strong> material(es)
                  </div>
                )}

                {mostrarConfirmacion && (
                  <div className="alert alert-warning">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong>¿Está seguro?</strong> Este es un cambio significativo ({porcentaje}%)
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPrecioTodos(false);
                    setMostrarConfirmacion(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleActualizarPrecioTodos}
                  disabled={loading || !porcentaje}
                >
                  {loading ? 'Aplicando...' : (mostrarConfirmacion ? 'Confirmar' : 'Aplicar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Precio Seleccionados */}
      {mostrarModalPrecioSeleccionados && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="fas fa-percentage me-2"></i>
                  Ajustar Precios - Seleccionados
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalPrecioSeleccionados(false);
                    setMostrarConfirmacion(false);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Ingrese el porcentaje de incremento/decremento.
                  <br />
                  <strong>Ejemplos:</strong> 10 = +10%, -5 = -5%
                </div>

                <div className="mb-3">
                  <label className="form-label">Porcentaje (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(e.target.value)}
                    placeholder="Ej: 10 o -5"
                    step="0.01"
                  />
                </div>

                {porcentaje && (
                  <div className={`alert ${parseFloat(porcentaje) >= 0 ? 'alert-success' : 'alert-danger'}`}>
                    <strong>Preview:</strong> Se aplicará{' '}
                    <strong>{parseFloat(porcentaje) >= 0 ? '+' : ''}{porcentaje}%</strong> a{' '}
                    <strong>{seleccionados.length}</strong> material(es) seleccionado(s)
                  </div>
                )}

                {mostrarConfirmacion && (
                  <div className="alert alert-warning">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong>¿Está seguro?</strong> Este es un cambio significativo ({porcentaje}%)
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPrecioSeleccionados(false);
                    setMostrarConfirmacion(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleActualizarPrecioSeleccionados}
                  disabled={loading || !porcentaje}
                >
                  {loading ? 'Aplicando...' : (mostrarConfirmacion ? 'Confirmar' : 'Aplicar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Precio Uno */}
      {mostrarModalPrecioUno && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="fas fa-percentage me-2"></i>
                  Ajustar Precio
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setMostrarModalPrecioUno(false);
                    setMostrarConfirmacion(false);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-secondary">
                  <strong>{materialSeleccionado?.nombre}</strong>
                  <br />
                  Precio actual:{' '}
                  {materialSeleccionado?.precioUnitario != null ? (
                    <strong className="text-success">
                      ${parseFloat(materialSeleccionado.precioUnitario).toFixed(2)}
                    </strong>
                  ) : (
                    <span className="text-muted">No definido</span>
                  )}
                </div>

                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Ingrese el porcentaje de incremento/decremento.
                </div>

                <div className="mb-3">
                  <label className="form-label">Porcentaje (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(e.target.value)}
                    placeholder="Ej: 10 o -5"
                    step="0.01"
                  />
                </div>

                {porcentaje && materialSeleccionado?.precioUnitario != null && (
                  <div className={`alert ${parseFloat(porcentaje) >= 0 ? 'alert-success' : 'alert-danger'}`}>
                    <strong>Nuevo precio:</strong> ${calcularNuevoPrecio(materialSeleccionado.precioUnitario, porcentaje)}
                  </div>
                )}

                {mostrarConfirmacion && (
                  <div className="alert alert-warning">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong>¿Está seguro?</strong> Este es un cambio significativo ({porcentaje}%)
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPrecioUno(false);
                    setMostrarConfirmacion(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleActualizarPrecioUno}
                  disabled={loading || !porcentaje}
                >
                  {loading ? 'Aplicando...' : (mostrarConfirmacion ? 'Confirmar' : 'Aplicar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialesPage;
