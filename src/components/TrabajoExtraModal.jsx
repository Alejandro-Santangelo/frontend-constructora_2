import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

const TrabajoExtraModal = ({ show, onClose, obra, trabajoExtraInicial = null, onGuardado }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados principales
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profesionalesDisponibles, setProfesionalesDisponibles] = useState([]);
  const [profesionalesAsignados, setProfesionalesAsignados] = useState([]);

  // Formulario principal
  const [formData, setFormData] = useState({
    nombre: '',
    observaciones: '',
    dias: [],
    profesionales: [],
    tareas: []
  });

  // Estado para agregar día
  const [nuevoDia, setNuevoDia] = useState('');

  // Estado para agregar profesional
  const [tipoProfesional, setTipoProfesional] = useState('ASIGNADO_OBRA');
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState('');
  const [profesionalManual, setProfesionalManual] = useState({
    nombre: '',
    especialidad: '',
    importe: ''
  });

  // Estado para nueva tarea
  const [nuevaTarea, setNuevaTarea] = useState({
    descripcion: '',
    estado: 'A_TERMINAR',
    importe: '',
    profesionalesAsignados: []
  });
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [editandoTareaIndex, setEditandoTareaIndex] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (show && obra) {
      cargarProfesionales();
      if (trabajoExtraInicial) {
        cargarTrabajoExtra();
      } else {
        resetearFormulario();
      }
    }
  }, [show, obra, trabajoExtraInicial]);

  const cargarProfesionales = async () => {
    try {
      setLoading(true);

      // Intentar cargar profesionales asignados a la obra
      try {
        const asignados = await api.obras.getProfesionales(obra.id, empresaSeleccionada.id);
        setProfesionalesAsignados(Array.isArray(asignados) ? asignados : []);
      } catch (errorAsignados) {
        // Si falla (400/404), continuar sin profesionales asignados
        console.warn('No se pudieron cargar profesionales asignados a la obra:', errorAsignados);
        console.warn('Error status:', errorAsignados.status);
        console.warn('Error response:', errorAsignados.response);
        console.warn('Error message:', errorAsignados.message);
        setProfesionalesAsignados([]);
      }

      // Cargar todos los profesionales disponibles
      const todos = await api.profesionales.getAll(empresaSeleccionada.id);
      setProfesionalesDisponibles(Array.isArray(todos) ? todos : []);

    } catch (error) {
      console.error('Error cargando profesionales:', error);
      // No mostrar error si al menos tenemos la lista general
      setProfesionalesAsignados([]);
      setProfesionalesDisponibles([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarTrabajoExtra = async () => {
    try {
      setLoading(true);
      const data = await api.trabajosExtra.getById(trabajoExtraInicial.id, empresaSeleccionada.id);

      console.log('📥 Trabajo extra recibido del backend:', JSON.stringify(data, null, 2));

      // Mapear profesionales del backend al formato del frontend
      const profesionalesMapeados = (data.profesionales || []).map(prof => ({
        id: prof.profesionalId, // puede ser null
        nombre: prof.nombre,
        especialidad: prof.especialidad,
        tipo: prof.tipo,
        importe: prof.importe || 0
      }));

      // Mapear tareas del backend al formato del frontend
      const tareasMapeadas = (data.tareas || []).map(tarea => ({
        descripcion: tarea.descripcion,
        estado: tarea.estado,
        importe: tarea.importe,
        profesionalesAsignados: tarea.profesionalesIndices || []
      }));

      setFormData({
        nombre: data.nombre || '',
        observaciones: data.observaciones || '',
        dias: Array.isArray(data.dias) ? data.dias : [],
        profesionales: profesionalesMapeados,
        tareas: tareasMapeadas
      });

    } catch (error) {
      console.error('Error cargando trabajo extra:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        setError('⚠️ El módulo de Trabajos Extra aún no está disponible en el backend');
      } else {
        setError('Error al cargar el trabajo extra: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetearFormulario = () => {
    setFormData({
      nombre: '',
      observaciones: '',
      dias: [],
      profesionales: [],
      tareas: []
    });
    setNuevoDia('');
    setProfesionalSeleccionado('');
    setProfesionalManual({ nombre: '', especialidad: '' });
    setNuevaTarea({
      descripcion: '',
      estado: 'A_TERMINAR',
      importe: '',
      profesionalesAsignados: []
    });
    setMostrarFormTarea(false);
    setEditandoTareaIndex(null);
    setError(null);
  };

  // Manejo de días
  const agregarDia = () => {
    if (!nuevoDia) {
      setError('Debe seleccionar una fecha');
      return;
    }

    if (formData.dias.includes(nuevoDia)) {
      setError('Esta fecha ya fue agregada');
      return;
    }

    setFormData(prev => ({
      ...prev,
      dias: [...prev.dias, nuevoDia].sort()
    }));
    setNuevoDia('');
    setError(null);
  };

  const eliminarDia = (dia) => {
    setFormData(prev => ({
      ...prev,
      dias: prev.dias.filter(d => d !== dia)
    }));
  };

  // Manejo de profesionales
  const agregarProfesional = () => {
    let nuevoProfesional = null;

    if (tipoProfesional === 'MANUAL') {
      if (!profesionalManual.nombre.trim()) {
        setError('Debe ingresar el nombre del profesional');
        return;
      }

      if (!profesionalManual.importe || parseFloat(profesionalManual.importe) <= 0) {
        setError('Debe ingresar un importe válido mayor a 0');
        return;
      }

      nuevoProfesional = {
        id: null,
        nombre: profesionalManual.nombre.trim(),
        especialidad: profesionalManual.especialidad.trim() || null,
        importe: parseFloat(profesionalManual.importe),
        tipo: 'MANUAL'
      };

      setProfesionalManual({ nombre: '', especialidad: '', importe: '' });

    } else {
      if (!profesionalSeleccionado) {
        setError('Debe seleccionar un profesional');
        return;
      }

      const listaProfesionales = tipoProfesional === 'ASIGNADO_OBRA'
        ? profesionalesAsignados
        : profesionalesDisponibles;

      const prof = listaProfesionales.find(p => p.id == profesionalSeleccionado);

      if (!prof) {
        setError('Profesional no encontrado');
        return;
      }

      // Verificar si ya está agregado
      if (formData.profesionales.some(p => p.id === prof.id)) {
        setError('Este profesional ya fue agregado');
        return;
      }

      nuevoProfesional = {
        id: prof.id,
        nombre: prof.nombre || '',
        especialidad: prof.especialidad || prof.tipo || null,
        tipo: prof.tipo || prof.especialidad || 'Sin especificar', // ✅ Tipo/especialidad del profesional
        origen: tipoProfesional, // ✅ De dónde se obtuvo (ASIGNADO_OBRA/DISPONIBLE)
        importe: parseFloat(prof.importe) || 0 // ✅ Agregar importe si existe
      };

      setProfesionalSeleccionado('');
    }

    if (nuevoProfesional) {
      setFormData(prev => ({
        ...prev,
        profesionales: [...prev.profesionales, nuevoProfesional]
      }));
      setError(null);
    }
  };

  const eliminarProfesional = (index) => {
    setFormData(prev => ({
      ...prev,
      profesionales: prev.profesionales.filter((_, i) => i !== index)
    }));
  };

  // Manejo de tareas
  const agregarOEditarTarea = () => {
    if (!nuevaTarea.descripcion.trim()) {
      setError('La descripción de la tarea es obligatoria');
      return;
    }

    const tareaConDatos = {
      descripcion: nuevaTarea.descripcion.trim(),
      estado: nuevaTarea.estado,
      importe: nuevaTarea.importe ? parseFloat(nuevaTarea.importe) : null,
      profesionalesAsignados: nuevaTarea.profesionalesAsignados
    };

    if (editandoTareaIndex !== null) {
      // Editar tarea existente
      setFormData(prev => ({
        ...prev,
        tareas: prev.tareas.map((t, i) => i === editandoTareaIndex ? tareaConDatos : t)
      }));
      setEditandoTareaIndex(null);
    } else {
      // Agregar nueva tarea
      setFormData(prev => ({
        ...prev,
        tareas: [...prev.tareas, tareaConDatos]
      }));
    }

    setNuevaTarea({
      descripcion: '',
      estado: 'A_TERMINAR',
      importe: '',
      profesionalesAsignados: []
    });
    setMostrarFormTarea(false);
    setError(null);
  };

  const editarTarea = (index) => {
    const tarea = formData.tareas[index];
    setNuevaTarea({
      descripcion: tarea.descripcion,
      estado: tarea.estado,
      importe: tarea.importe || '',
      profesionalesAsignados: tarea.profesionalesAsignados || []
    });
    setEditandoTareaIndex(index);
    setMostrarFormTarea(true);
  };

  const eliminarTarea = (index) => {
    setFormData(prev => ({
      ...prev,
      tareas: prev.tareas.filter((_, i) => i !== index)
    }));
  };

  const cancelarEdicionTarea = () => {
    setNuevaTarea({
      descripcion: '',
      estado: 'A_TERMINAR',
      importe: '',
      profesionalesAsignados: []
    });
    setEditandoTareaIndex(null);
    setMostrarFormTarea(false);
  };

  const toggleProfesionalEnTarea = (profesionalId) => {
    setNuevaTarea(prev => {
      const yaAsignado = prev.profesionalesAsignados.includes(profesionalId);
      return {
        ...prev,
        profesionalesAsignados: yaAsignado
          ? prev.profesionalesAsignados.filter(id => id !== profesionalId)
          : [...prev.profesionalesAsignados, profesionalId]
      };
    });
  };

  // Cálculo automático del total
  const calcularTotal = () => {
    // Calcular total de profesionales (importe × días)
    const totalProfesionales = formData.profesionales.reduce((sum, prof) => {
      const importe = parseFloat(prof.importe) || 0;
      const dias = formData.dias.length || 0;
      return sum + (importe * dias);
    }, 0);

    // Calcular total de tareas
    const totalTareas = formData.tareas.reduce((sum, tarea) => {
      return sum + (parseFloat(tarea.importe) || 0);
    }, 0);

    return totalProfesionales + totalTareas;
  };

  // Validación y guardado
  const validarFormulario = () => {
    if (!formData.nombre.trim()) {
      setError('El nombre del trabajo extra es obligatorio');
      return false;
    }

    // ✅ Validar que todos los profesionales tengan nombre y tipo
    for (let i = 0; i < formData.profesionales.length; i++) {
      const prof = formData.profesionales[i];
      if (!prof.nombre || !prof.nombre.trim()) {
        setError(`El profesional #${i + 1} no tiene nombre. Por favor, complete la información o elimínelo.`);
        return false;
      }
      if (!prof.tipo || !prof.tipo.trim()) {
        setError(`El profesional #${i + 1} (${prof.nombre}) no tiene tipo/especialidad. Por favor, complete la información.`);
        return false;
      }
    }

    return true;
  };

  const handleGuardar = async () => {
    if (!validarFormulario()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Mapear profesionales al formato del backend
      const profesionalesParaBackend = formData.profesionales.map(prof => ({
        profesionalId: prof.id, // null si es manual
        nombre: prof.nombre || '', // ✅ Asegurar que siempre haya un nombre
        especialidad: prof.especialidad || prof.tipo || '',
        tipo: prof.tipo || prof.especialidad || 'Sin especificar', // ✅ Tipo/especialidad del profesional
        importe: parseFloat(prof.importe) || 0
      }));

      console.log('🔍 Profesionales originales en formData:', formData.profesionales);
      console.log('🔍 Profesionales mapeados para backend:', profesionalesParaBackend);

      // Mapear tareas al formato del backend
      const tareasParaBackend = formData.tareas.map(tarea => ({
        descripcion: tarea.descripcion,
        estado: tarea.estado,
        importe: tarea.importe,
        profesionalesIndices: tarea.profesionalesAsignados || []
      }));

      const dataParaEnviar = {
        obraId: obra.id,
        nombre: formData.nombre.trim(),
        observaciones: formData.observaciones.trim() || null,
        dias: formData.dias,
        profesionales: profesionalesParaBackend,
        tareas: tareasParaBackend
      };

      console.log('📤 Enviando trabajo extra al backend:', JSON.stringify(dataParaEnviar, null, 2));

      let resultado;
      if (trabajoExtraInicial) {
        resultado = await api.trabajosExtra.update(
          trabajoExtraInicial.id,
          dataParaEnviar,
          empresaSeleccionada.id
        );
      } else {
        resultado = await api.trabajosExtra.create(
          dataParaEnviar,
          empresaSeleccionada.id
        );
      }

      if (onGuardado) {
        onGuardado(resultado);
      }

      resetearFormulario();
      onClose();

    } catch (error) {
      console.error('Error guardando trabajo extra:', error);
      console.error('Error status:', error.status);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error message:', error.message);

      let mensajeError = 'Error al guardar el trabajo extra';

      // Detectar error de endpoint no disponible (500 con mensaje específico)
      if (error.message?.includes('No static resource') ||
          error.message?.includes('api/trabajos-extra')) {
        mensajeError = '🚫 ERROR DE BACKEND:\n\n' +
                      'El endpoint /api/trabajos-extra NO ESTÁ DISPONIBLE.\n\n' +
                      'Posibles causas:\n' +
                      '• El controlador TrabajoExtraController no existe en el backend\n' +
                      '• El controlador no está mapeado correctamente\n' +
                      '• El servicio ITrabajosExtraService no está implementado\n\n' +
                      'SOLUCIÓN:\n' +
                      'Contacte al desarrollador del backend para implementar:\n' +
                      '1. TrabajoExtraController con @RestController y @RequestMapping("/api/trabajos-extra")\n' +
                      '2. ITrabajosExtraService con los métodos CRUD necesarios\n' +
                      '3. Modelo TrabajoExtra en la base de datos';
      } else if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        mensajeError = '⚠️ El módulo de Trabajos Extra aún no está disponible en el backend. Por favor, contacte al administrador.';
      } else if (error.response?.data?.message) {
        mensajeError = error.response.data.message;
      } else if (error.response?.data?.error) {
        mensajeError = error.response.data.error;
      } else if (error.message) {
        mensajeError = error.message;
      }

      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'TERMINADA': return 'bg-success';
      case 'A_TERMINAR': return 'bg-warning';
      case 'POSTERGADA': return 'bg-secondary';
      case 'SUSPENDIDA': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'TERMINADA': return '✅ Terminada';
      case 'A_TERMINAR': return '⏳ A Terminar';
      case 'POSTERGADA': return '⏸️ Postergada';
      case 'SUSPENDIDA': return '🚫 Suspendida';
      default: return estado;
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-tools me-2"></i>
              {trabajoExtraInicial ? 'Editar' : 'Nuevo'} Trabajo Extra - {obra?.nombre}
            </h5>
            <button
              type="button"
              className="btn btn-light btn-sm ms-auto"
              onClick={onClose}
              disabled={loading}
            >
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setError(null)}
                ></button>
              </div>
            )}

            {/* INFORMACIÓN GENERAL */}
            <div className="card mb-3">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-info-circle me-2"></i>
                  Información General
                </h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-8 mb-3">
                    <label className="form-label">
                      Título del Trabajo Extra *
                      <small className="text-muted ms-2">(Ej: "Tareas del día 15/12" o "Instalación aire acondicionado")</small>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                      placeholder="Ingrese un título descriptivo para este trabajo extra"
                      required
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">
                      Total General
                      <small className="text-muted ms-2">(profesionales + tareas)</small>
                    </label>
                    <input
                      type="text"
                      className="form-control bg-light fw-bold text-success"
                      value={`$${calcularTotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                      readOnly
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Observaciones</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={formData.observaciones}
                    onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Observaciones generales del trabajo extra"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* DÍAS DEL TRABAJO */}
            <div className="card mb-3">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-calendar-alt me-2"></i>
                  Días del Trabajo
                </h6>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-8">
                    <input
                      type="date"
                      className="form-control"
                      value={nuevoDia}
                      onChange={(e) => setNuevoDia(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <button
                      type="button"
                      className="btn btn-primary w-100"
                      onClick={agregarDia}
                    >
                      <i className="fas fa-plus me-2"></i>
                      Agregar Día
                    </button>
                  </div>
                </div>

                {formData.dias.length > 0 ? (
                  <div className="list-group">
                    {formData.dias.map((dia, index) => (
                      <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>
                          <i className="fas fa-calendar-day me-2 text-primary"></i>
                          {new Date(dia + 'T00:00:00').toLocaleDateString('es-AR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => eliminarDia(dia)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted py-3">
                    <i className="fas fa-calendar-times fa-2x mb-2"></i>
                    <p className="mb-0">No hay días agregados</p>
                  </div>
                )}
              </div>
            </div>

            {/* PROFESIONALES ASIGNADOS */}
            <div className="card mb-3">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-users me-2"></i>
                  Profesionales Asignados
                </h6>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-12 mb-2">
                    <label className="form-label">Seleccionar desde:</label>
                    <div className="btn-group w-100" role="group">
                      <input
                        type="radio"
                        className="btn-check"
                        name="tipoProfesional"
                        id="tipoAsignado"
                        value="ASIGNADO_OBRA"
                        checked={tipoProfesional === 'ASIGNADO_OBRA'}
                        onChange={(e) => setTipoProfesional(e.target.value)}
                      />
                      <label className="btn btn-outline-primary" htmlFor="tipoAsignado">
                        Asignados a la obra
                      </label>

                      <input
                        type="radio"
                        className="btn-check"
                        name="tipoProfesional"
                        id="tipoGeneral"
                        value="LISTADO_GENERAL"
                        checked={tipoProfesional === 'LISTADO_GENERAL'}
                        onChange={(e) => setTipoProfesional(e.target.value)}
                      />
                      <label className="btn btn-outline-primary" htmlFor="tipoGeneral">
                        Listado general
                      </label>

                      <input
                        type="radio"
                        className="btn-check"
                        name="tipoProfesional"
                        id="tipoManual"
                        value="MANUAL"
                        checked={tipoProfesional === 'MANUAL'}
                        onChange={(e) => setTipoProfesional(e.target.value)}
                      />
                      <label className="btn btn-outline-primary" htmlFor="tipoManual">
                        Ingresar manualmente
                      </label>
                    </div>
                  </div>
                </div>

                {tipoProfesional === 'MANUAL' ? (
                  <div className="row mb-3">
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Nombre del profesional *"
                        value={profesionalManual.nombre}
                        onChange={(e) => setProfesionalManual(prev => ({ ...prev, nombre: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Especialidad (opcional)"
                        value={profesionalManual.especialidad}
                        onChange={(e) => setProfesionalManual(prev => ({ ...prev, especialidad: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Importe por día *"
                        value={profesionalManual.importe}
                        onChange={(e) => setProfesionalManual(prev => ({ ...prev, importe: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-2">
                      <button
                        type="button"
                        className="btn btn-success w-100"
                        onClick={agregarProfesional}
                      >
                        <i className="fas fa-user-plus me-2"></i>
                        Agregar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row mb-3">
                    <div className="col-md-9">
                      <select
                        className="form-select"
                        value={profesionalSeleccionado}
                        onChange={(e) => setProfesionalSeleccionado(e.target.value)}
                      >
                        <option value="">Seleccionar profesional...</option>
                        {(tipoProfesional === 'ASIGNADO_OBRA' ? profesionalesAsignados : profesionalesDisponibles).map(prof => (
                          <option key={prof.id} value={prof.id}>
                            {prof.nombre} - {prof.especialidad || prof.tipo || 'Sin especialidad'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <button
                        type="button"
                        className="btn btn-success w-100"
                        onClick={agregarProfesional}
                      >
                        <i className="fas fa-plus me-2"></i>
                        Agregar
                      </button>
                    </div>
                  </div>
                )}

                {formData.profesionales.length > 0 ? (
                  <div className="list-group">
                    {formData.profesionales.map((prof, index) => (
                      <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <i className="fas fa-user me-2 text-success"></i>
                          <strong>{prof.nombre}</strong>
                          {prof.especialidad && (
                            <span className="text-muted ms-2">({prof.especialidad})</span>
                          )}
                          {prof.importe && (
                            <span className="text-success ms-2 fw-bold">
                              ${parseFloat(prof.importe).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/día
                            </span>
                          )}
                          <span className="badge bg-secondary ms-2">
                            {prof.tipo === 'MANUAL' ? 'Manual' :
                             prof.tipo === 'ASIGNADO_OBRA' ? 'Asignado' : 'General'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => eliminarProfesional(index)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted py-3">
                    <i className="fas fa-user-slash fa-2x mb-2"></i>
                    <p className="mb-0">No hay profesionales asignados</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              <i className="fas fa-times me-2"></i>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGuardar}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Guardar Trabajo Extra
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrabajoExtraModal;
