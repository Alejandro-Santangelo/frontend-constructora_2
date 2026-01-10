import React, { useState, useEffect, useContext } from 'react';
import { useEmpresa } from '../EmpresaContext';
import { SidebarContext } from '../App';
import { catalogoGastosService } from '../services/gastosGeneralesService';

const GastosGeneralesPage = () => {
  const { empresaSeleccionada } = useEmpresa();
  const { setGastosControls } = useContext(SidebarContext) || {};

  // Estados principales
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todos');
  const [seleccionados, setSeleccionados] = useState([]);

  // Estados para modales
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [mostrarModalPrecioTodos, setMostrarModalPrecioTodos] = useState(false);
  const [mostrarModalPrecioSeleccionados, setMostrarModalPrecioSeleccionados] = useState(false);
  const [mostrarModalPrecioUno, setMostrarModalPrecioUno] = useState(false);

  // Estados para formularios
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria: 'SERVICIOS',
    categoriaCustom: '',
    unidadMedida: '',
    precioUnitarioBase: ''
  });

  const [gastoSeleccionado, setGastoSeleccionado] = useState(null);
  const [porcentaje, setPorcentaje] = useState('');
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);

  // Cargar gastos al montar
  useEffect(() => {
    if (empresaSeleccionada?.id) {
      cargarGastos();
    }
  }, [empresaSeleccionada]);

  // Configurar controles del sidebar
  useEffect(() => {
    if (setGastosControls) {
      setGastosControls({
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
      if (setGastosControls) {
        setGastosControls(null);
      }
    };
  }, [setGastosControls, seleccionados.length]);

  const cargarGastos = async () => {
    if (!empresaSeleccionada?.id) return;

    setLoading(true);
    try {
      const data = await catalogoGastosService.obtenerTodos(empresaSeleccionada.id);
      setGastos(Array.isArray(data) ? data : []);

      // Extraer categorías únicas y ordenarlas
      const categoriasUnicas = [...new Set(data.map(g => g.categoria).filter(Boolean))].sort();
      setCategoriasDisponibles([...categoriasUnicas, '__OTRO__']);
    } catch (error) {
      console.error('Error cargando gastos:', error);
      mostrarNotificacion('Error al cargar gastos generales', 'error');
      setGastos([]);
      setCategoriasDisponibles(['__OTRO__']);
    } finally {
      setLoading(false);
    }
  };

  const mostrarNotificacion = (mensaje, tipo = 'success') => {
    // Implementar con tu sistema de notificaciones
    const alertClass = tipo === 'success' ? 'alert-success' : 'alert-danger';
    const div = document.createElement('div');
    div.className = `alert ${alertClass} position-fixed top-0 start-50 translate-middle-x mt-3`;
    div.style.zIndex = '9999';
    div.textContent = mensaje;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  };

  // Filtrar gastos
  const gastosFiltrados = gastos.filter(gasto => {
    const matchSearch = gasto.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       gasto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaFilter === 'todos' || gasto.categoria === categoriaFilter;
    return matchSearch && matchCategoria;
  });

  // Categorías únicas para el filtro
  const categoriasUnicas = ['todos', ...new Set(gastos.map(g => g.categoria).filter(Boolean))];

  // Handlers de selección
  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSeleccionTodos = () => {
    if (seleccionados.length === gastosFiltrados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(gastosFiltrados.map(g => g.id));
    }
  };

  // CRUD Handlers
  const abrirModalCrear = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      categoria: 'SERVICIOS',
      categoriaCustom: '',
      unidadMedida: '',
      precioUnitarioBase: ''
    });
    setMostrarModalCrear(true);
  };

  const abrirModalEditar = (gasto) => {
    setGastoSeleccionado(gasto);
    setFormData({
      nombre: gasto.nombre || '',
      descripcion: gasto.descripcion || '',
      categoria: gasto.categoria || 'SERVICIOS',
      categoriaCustom: '',
      unidadMedida: gasto.unidadMedida || '',
      precioUnitarioBase: gasto.precioUnitarioBase || ''
    });
    setMostrarModalEditar(true);
  };

  const abrirModalEliminar = (gasto) => {
    setGastoSeleccionado(gasto);
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
      const categoriaFinal = formData.categoria === '__OTRO__'
        ? formData.categoriaCustom.trim()
        : formData.categoria;

      const nuevoGasto = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        categoria: categoriaFinal,
        unidadMedida: formData.unidadMedida.trim() || null,
        precioUnitarioBase: formData.precioUnitarioBase ? parseFloat(formData.precioUnitarioBase) : null
      };

      await catalogoGastosService.crear(nuevoGasto, empresaSeleccionada.id);
      mostrarNotificacion('Gasto general creado exitosamente');
      setMostrarModalCrear(false);
      cargarGastos();
    } catch (error) {
      console.error('Error creando gasto:', error);
      mostrarNotificacion('Error al crear gasto general', 'error');
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
      const categoriaFinal = formData.categoria === '__OTRO__'
        ? formData.categoriaCustom.trim()
        : formData.categoria;

      const gastoActualizado = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        categoria: categoriaFinal,
        unidadMedida: formData.unidadMedida.trim() || null,
        precioUnitarioBase: formData.precioUnitarioBase ? parseFloat(formData.precioUnitarioBase) : null
      };

      await catalogoGastosService.actualizar(gastoSeleccionado.id, gastoActualizado, empresaSeleccionada.id);
      mostrarNotificacion('Gasto general actualizado exitosamente');
      setMostrarModalEditar(false);
      cargarGastos();
    } catch (error) {
      console.error('Error actualizando gasto:', error);
      mostrarNotificacion('Error al actualizar gasto general', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async () => {
    if (!gastoSeleccionado) return;

    setLoading(true);
    try {
      await catalogoGastosService.eliminar(gastoSeleccionado.id, empresaSeleccionada.id);
      mostrarNotificacion('Gasto general eliminado exitosamente');
      setMostrarModalEliminar(false);
      setGastoSeleccionado(null);
      cargarGastos();
    } catch (error) {
      console.error('Error eliminando gasto:', error);
      mostrarNotificacion('Error al eliminar gasto general', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handlers de actualización de precios
  const handleActualizarPrecioTodos = async () => {
    const porcentajeNum = parseFloat(porcentaje);
    if (isNaN(porcentajeNum)) {
      mostrarNotificacion('Ingrese un porcentaje válido', 'error');
      return;
    }

    setLoading(true);
    try {
      await catalogoGastosService.actualizarPrecioTodos(porcentajeNum, empresaSeleccionada.id);
      mostrarNotificacion(`Precios actualizados correctamente (${porcentajeNum >= 0 ? '+' : ''}${porcentajeNum}%)`);
      setMostrarModalPrecioTodos(false);
      setPorcentaje('');
      cargarGastos();
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

    setLoading(true);
    try {
      await catalogoGastosService.actualizarPrecioVarios(seleccionados, porcentajeNum, empresaSeleccionada.id);
      mostrarNotificacion(`Precios de ${seleccionados.length} gastos actualizados (${porcentajeNum >= 0 ? '+' : ''}${porcentajeNum}%)`);
      setMostrarModalPrecioSeleccionados(false);
      setPorcentaje('');
      setSeleccionados([]);
      cargarGastos();
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

    setLoading(true);
    try {
      await catalogoGastosService.actualizarPrecioUno(gastoSeleccionado.id, porcentajeNum, empresaSeleccionada.id);
      mostrarNotificacion(`Precio actualizado (${porcentajeNum >= 0 ? '+' : ''}${porcentajeNum}%)`);
      setMostrarModalPrecioUno(false);
      setPorcentaje('');
      setGastoSeleccionado(null);
      cargarGastos();
    } catch (error) {
      console.error('Error actualizando precio:', error);
      mostrarNotificacion('Error al actualizar precio', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <i className="fas fa-receipt me-2"></i>
          Gastos Generales
        </h2>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value)}
              >
                {categoriasUnicas.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'todos' ? 'Todas las categorías' : cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setSearchTerm('');
                  setCategoriaFilter('todos');
                }}
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
          ) : gastosFiltrados.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="fas fa-inbox fa-3x mb-3"></i>
              <p>No hay gastos generales para mostrar</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={seleccionados.length === gastosFiltrados.length && gastosFiltrados.length > 0}
                        onChange={toggleSeleccionTodos}
                      />
                    </th>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Unidad</th>
                    <th>Precio Base</th>
                    <th style={{ width: '150px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosFiltrados.map(gasto => (
                    <tr key={gasto.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(gasto.id)}
                          onChange={() => toggleSeleccion(gasto.id)}
                        />
                      </td>
                      <td>{gasto.id}</td>
                      <td className="fw-bold">{gasto.nombre}</td>
                      <td>
                        <small className="text-muted">
                          {gasto.descripcion || '-'}
                        </small>
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {gasto.categoria}
                        </span>
                      </td>
                      <td>{gasto.unidadMedida || '-'}</td>
                      <td>
                        {gasto.precioUnitarioBase != null ? (
                          <span className="fw-bold text-success">
                            ${parseFloat(gasto.precioUnitarioBase).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-warning"
                            onClick={() => {
                              setGastoSeleccionado(gasto);
                              setMostrarModalPrecioUno(true);
                            }}
                            title="Actualizar precio"
                          >
                            <i className="fas fa-percentage"></i>
                          </button>
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => abrirModalEditar(gasto)}
                            title="Editar"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => abrirModalEliminar(gasto)}
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
                  Nuevo Gasto General
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
                      maxLength={200}
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
                    <label className="form-label">
                      Categoría <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value, categoriaCustom: '' })}
                      required
                    >
                      {categoriasDisponibles.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === '__OTRO__' ? 'Otros...' : cat}
                        </option>
                      ))}
                    </select>
                    {formData.categoria === '__OTRO__' && (
                      <input
                        type="text"
                        className="form-control mt-2"
                        placeholder="Escribir categoría..."
                        value={formData.categoriaCustom}
                        onChange={(e) => setFormData({ ...formData, categoriaCustom: e.target.value })}
                        maxLength={100}
                        required
                      />
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Unidad de Medida</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.unidadMedida}
                      onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                      maxLength={50}
                      placeholder="m³, kg, litros, etc."
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Precio Unitario Base</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.precioUnitarioBase}
                      onChange={(e) => setFormData({ ...formData, precioUnitarioBase: e.target.value })}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
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
                  Editar Gasto General
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
                      maxLength={200}
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
                    <label className="form-label">
                      Categoría <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value, categoriaCustom: '' })}
                      required
                    >
                      {categoriasDisponibles.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === '__OTRO__' ? 'Otros...' : cat}
                        </option>
                      ))}
                    </select>
                    {formData.categoria === '__OTRO__' && (
                      <input
                        type="text"
                        className="form-control mt-2"
                        placeholder="Escribir categoría..."
                        value={formData.categoriaCustom}
                        onChange={(e) => setFormData({ ...formData, categoriaCustom: e.target.value })}
                        maxLength={100}
                        required
                      />
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Unidad de Medida</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.unidadMedida}
                      onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                      maxLength={50}
                      placeholder="m³, kg, litros, etc."
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Precio Unitario Base</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.precioUnitarioBase}
                      onChange={(e) => setFormData({ ...formData, precioUnitarioBase: e.target.value })}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
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
                <p>¿Está seguro que desea eliminar el gasto general?</p>
                <div className="alert alert-warning">
                  <strong>{gastoSeleccionado?.nombre}</strong>
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

      {/* Modal Actualizar Precio Todos */}
      {mostrarModalPrecioTodos && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="fas fa-percentage me-2"></i>
                  Actualizar Precios - Todos
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalPrecioTodos(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Ingrese el porcentaje de incremento. Use números positivos para aumentar y negativos para reducir.
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
                  <div className="alert alert-secondary">
                    <strong>Preview:</strong> Se aplicará un incremento del{' '}
                    <strong>{parseFloat(porcentaje) >= 0 ? '+' : ''}{porcentaje}%</strong> a{' '}
                    <strong>{gastos.length}</strong> registro(s)
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalPrecioTodos(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleActualizarPrecioTodos}
                  disabled={loading || !porcentaje}
                >
                  {loading ? 'Aplicando...' : 'Aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Actualizar Precio Seleccionados */}
      {mostrarModalPrecioSeleccionados && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="fas fa-percentage me-2"></i>
                  Actualizar Precios - Seleccionados
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalPrecioSeleccionados(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Ingrese el porcentaje de incremento. Use números positivos para aumentar y negativos para reducir.
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
                  <div className="alert alert-secondary">
                    <strong>Preview:</strong> Se aplicará un incremento del{' '}
                    <strong>{parseFloat(porcentaje) >= 0 ? '+' : ''}{porcentaje}%</strong> a{' '}
                    <strong>{seleccionados.length}</strong> registro(s) seleccionado(s)
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalPrecioSeleccionados(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleActualizarPrecioSeleccionados}
                  disabled={loading || !porcentaje}
                >
                  {loading ? 'Aplicando...' : 'Aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Actualizar Precio Uno */}
      {mostrarModalPrecioUno && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="fas fa-percentage me-2"></i>
                  Actualizar Precio
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setMostrarModalPrecioUno(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-secondary">
                  <strong>{gastoSeleccionado?.nombre}</strong>
                  <br />
                  Precio actual:{' '}
                  {gastoSeleccionado?.precioUnitarioBase != null ? (
                    <strong className="text-success">
                      ${parseFloat(gastoSeleccionado.precioUnitarioBase).toFixed(2)}
                    </strong>
                  ) : (
                    <span className="text-muted">No definido</span>
                  )}
                </div>

                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Ingrese el porcentaje de incremento. Use números positivos para aumentar y negativos para reducir.
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

                {porcentaje && gastoSeleccionado?.precioUnitarioBase != null && (
                  <div className="alert alert-secondary">
                    <strong>Nuevo precio:</strong>{' '}
                    ${(parseFloat(gastoSeleccionado.precioUnitarioBase) * (1 + parseFloat(porcentaje) / 100)).toFixed(2)}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalPrecioUno(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleActualizarPrecioUno}
                  disabled={loading || !porcentaje}
                >
                  {loading ? 'Aplicando...' : 'Aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GastosGeneralesPage;
