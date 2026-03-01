import React, { useState, useEffect } from 'react';
import { getConfigPresupuesto, TIPOS_PRESUPUESTO } from '../constants/presupuestoTypes';
import SeleccionarProfesionalesModal from './SeleccionarProfesionalesModal';

/**
 * Modal Unificado para crear/editar presupuestos
 * Reemplaza los modales:
 * - Modal de presupuesto tradicional
 * - Modal de trabajo diario
 * - Modal de trabajo adicional (tarea leve)
 * - Modal de crear obra rápida
 *
 * @param {Object} props
 * @param {boolean} props.mostrar - Mostrar/ocultar modal
 * @param {Function} props.onCerrar - Callback al cerrar
 * @param {Function} props.onGuardar - Callback al guardar (datos) => Promise
 * @param {string} props.tipoPresupuesto - 'TRADICIONAL' | 'TRABAJO_DIARIO' | 'TRABAJO_EXTRA' | 'TAREA_LEVE'
 * @param {Object} props.contexto - Contexto de creación
 * @param {number} props.contexto.obraId - ID de obra (si aplica)
 * @param {string} props.contexto.obraNombre - Nombre de obra (para mostrar)
 * @param {number} props.contexto.trabajoExtraId - ID de trabajo extra (si es nieta)
 * @param {string} props.contexto.trabajoExtraNombre - Nombre trabajo extra
 * @param {Object} props.datosIniciales - Datos para edición (opcional)
 * @param {Array} props.profesionalesDisponibles - Profesionales disponibles para seleccionar
 * @param {number} props.empresaId - ID de la empresa
 * @param {Function} props.showNotification - Función para mostrar notificaciones
 * @param {Function} props.onRefrescarProfesionales - Callback para refrescar profesionales
 */
const ModalPresupuestoUnificado = ({
  mostrar,
  onCerrar,
  onGuardar,
  tipoPresupuesto,
  contexto = {},
  datosIniciales = null,
  profesionalesDisponibles = [],
  empresaId = null,
  showNotification = null,
  onRefrescarProfesionales = null
}) => {
  const config = getConfigPresupuesto(tipoPresupuesto);
  const esEdicion = !!datosIniciales;
  const esNieta = !!contexto.trabajoExtraId;

  // Estado del formulario
  const [formData, setFormData] = useState({
    // Identificación
    tipoPresupuesto,
    obraId: contexto.obraId || null,
    trabajoExtraId: contexto.trabajoExtraId || null,

    // Datos básicos - pre-poblar nombre desde contexto de obra/trabajo extra
    nombreObra: esNieta ? (contexto.trabajoExtraNombre || contexto.obraNombre || '') : (contexto.obraNombre || ''),
    direccionObraCalle: '',
    direccionObraAltura: '',
    direccionObraBarrio: '',
    direccionObraTorre: '',
    direccionObraPiso: '',
    direccionObraDepartamento: '',

    // Cliente
    idCliente: null,
    nombreSolicitante: '',
    telefono: '',
    mail: '',
    direccionParticular: '',

    // Fechas
    fechaProbableInicio: '',
    vencimiento: new Date().toISOString().split('T')[0], // Hoy por defecto
    tiempoEstimadoTerminacion: '',

    // Descripción
    descripcion: '',
    observaciones: '',

    // Para TAREA_LEVE
    importe: '',
    diasNecesarios: '',
    fechaInicio: '',

    // Profesionales (para todos los tipos)
    profesionales: [],

    // Estado
    estado: config.estadoInicial
  });

  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [mostrarModalSeleccionarProfesionales, setMostrarModalSeleccionarProfesionales] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Cargar datos iniciales si es edición
  useEffect(() => {
    if (datosIniciales) {
      setFormData({ ...formData, ...datosIniciales });
    }
  }, [datosIniciales]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar campos según tipo
    if (!formData.direccionObraCalle || !formData.direccionObraAltura) {
      alert('Calle y Altura son campos obligatorios');
      return;
    }

    if (config.requiereObraId && !formData.obraId) {
      alert(`${config.label} requiere estar vinculado a una obra`);
      return;
    }

    setGuardando(true);
    try {
      // Agregar profesionales seleccionados al formData
      const datosCompletos = {
        ...formData,
        profesionales: profesionalesSeleccionados.map(p => ({
          profesionalId: p.id,
          honorarioDia: p.honorarioDia
        }))
      };

      await onGuardar(datosCompletos);
      onCerrar();
    } catch (error) {
      console.error('Error al guardar:', error);
      alert(`Error al guardar: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  if (!mostrar) return null;

  return (
    <>
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content" style={{ borderRadius: '15px', overflow: 'hidden' }}>
          {/* HEADER CON GRADIENTE Y TÍTULO CENTRADO */}
          <div
            className="modal-header text-white text-center position-relative"
            style={{
              background: config.gradient,
              borderBottom: `3px solid ${config.color}`,
              padding: '1.5rem 2rem'
            }}
          >
            <div className="w-100">
              {/* Título principal centrado */}
              <h4 className="modal-title mb-2" style={{ fontWeight: '600' }}>
                <i className={`fas ${config.icon} me-3`} style={{ fontSize: '1.5rem' }}></i>
                Presupuesto para {config.label}
              </h4>

              {/* Información contextual si es hijo o nieto */}
              {(contexto.obraNombre || contexto.trabajoExtraNombre) && (
                <div className="small text-white-50 mt-2">
                  {esNieta ? (
                    <>
                      📎 Vinculada a: <strong>{contexto.trabajoExtraNombre}</strong>
                      <span className="mx-2">→</span>
                      de la obra: <strong>{contexto.obraNombre}</strong>
                    </>
                  ) : contexto.obraNombre ? (
                    <>
                      📎 Vinculado a obra: <strong>{contexto.obraNombre}</strong>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {/* Botón cerrar */}
            <button
              type="button"
              className="btn-close btn-close-white position-absolute"
              onClick={onCerrar}
              style={{ top: '1rem', right: '1rem' }}
            ></button>
          </div>

          {/* BODY */}
          <div className="modal-body" style={{ padding: '2rem', backgroundColor: '#f8f9fa' }}>
            <form onSubmit={handleSubmit} id="formPresupuesto">
              {/* Información de vinculación (solo si es hijo o nieto) */}
              {contexto.obraId && (
                <div
                  className="card mb-4"
                  style={{
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    background: esNieta
                      ? 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)'
                      : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
                  }}
                >
                  <div className="card-body py-3">
                    <div className="d-flex align-items-center">
                      <div
                        className="me-3"
                        style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '12px',
                          background: config.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        <i className={`fas ${config.icon} text-white`} style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                          <i className="fas fa-link me-2 text-muted"></i>
                          Vinculado a:
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#333' }}>
                          {esNieta ? contexto.trabajoExtraNombre : contexto.obraNombre}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos según tipo de presupuesto */}
              {renderCamposSegunTipo()}

              {/* Profesionales */}
              <div className="card mb-4" style={{ border: 'none', borderRadius: '12px' }}>
                <div
                  className="card-header"
                  style={{
                    background: 'linear-gradient(90deg, #ec4899 0%, #db2777 100%)',
                    color: 'white',
                    borderRadius: '12px 12px 0 0',
                    padding: '1rem 1.5rem'
                  }}
                >
                  <h6 className="mb-0" style={{ fontWeight: '600' }}>
                    <i className="fas fa-users me-2"></i>
                    Profesionales Asignados
                    <span className="badge bg-white text-dark ms-2">
                      {profesionalesSeleccionados.length} seleccionados
                    </span>
                  </h6>
                </div>
                <div className="card-body p-4">
                  {/* Botón para abrir modal de selección */}
                  <button
                    type="button"
                    className="btn btn-outline-primary mb-3"
                    onClick={() => setMostrarModalSeleccionarProfesionales(true)}
                    style={{
                      borderRadius: '10px',
                      padding: '0.75rem 1.5rem',
                      border: '2px dashed #3b82f6',
                      fontWeight: '600'
                    }}
                  >
                    <i className="fas fa-user-plus me-2"></i>
                    Seleccionar Profesionales
                  </button>

                  {/* Lista de profesionales seleccionados */}
                  {profesionalesSeleccionados.length > 0 ? (
                    <div className="border rounded p-3" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb !important' }}>
                      <div className="list-group">
                        {profesionalesSeleccionados.map((prof, idx) => (
                          <div
                            key={prof.id || idx}
                            className="list-group-item d-flex justify-content-between align-items-center mb-2"
                            style={{
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              backgroundColor: 'white'
                            }}
                          >
                            <div>
                              <div className="fw-bold" style={{ color: '#1f2937', fontSize: '0.95rem' }}>
                                {prof.nombre}
                              </div>
                              <small className="text-muted">
                                <i className="fas fa-briefcase me-1"></i>
                                {prof.tipoProfesional} · ${parseFloat(prof.honorarioDia || 0).toFixed(2)}/día
                              </small>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                setProfesionalesSeleccionados(profesionalesSeleccionados.filter((_, i) => i !== idx));
                              }}
                              style={{ borderRadius: '6px' }}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted text-center mb-0">
                      <i className="fas fa-user-friends me-2"></i>
                      No hay profesionales seleccionados
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* FOOTER */}
          <div
            className="modal-footer"
            style={{
              padding: '1.5rem 2rem',
              backgroundColor: '#f8f9fa',
              borderTop: '2px solid #e5e7eb'
            }}
          >
            <button
              type="button"
              className="btn btn-light btn-lg"
              onClick={onCerrar}
              disabled={guardando}
              style={{
                borderRadius: '10px',
                padding: '0.75rem 2rem',
                fontWeight: '600',
                border: '2px solid #d1d5db'
              }}
            >
              <i className="fas fa-times me-2"></i>
              Cancelar
            </button>
            <button
              type="submit"
              form="formPresupuesto"
              className="btn btn-lg text-white"
              disabled={guardando}
              style={{
                background: config.gradient,
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 2.5rem',
                fontWeight: '600',
                boxShadow: `0 4px 12px ${config.color}40`
              }}
            >
              {guardando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  {esEdicion ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Modal de selección de profesionales */}
      <SeleccionarProfesionalesModal
        show={mostrarModalSeleccionarProfesionales}
        onHide={() => setMostrarModalSeleccionarProfesionales(false)}
        profesionalesDisponibles={profesionalesDisponibles}
        profesionalesSeleccionados={profesionalesSeleccionados}
        onConfirmar={(seleccionados) => {
          setProfesionalesSeleccionados(seleccionados);
          setMostrarModalSeleccionarProfesionales(false);
        }}
        asignacionesExistentes={[]}
        semanaActual={null}
        fechaInicio={null}
        fechaFin={null}
        empresaId={empresaId}
        showNotification={showNotification}
        onNuevoProfesional={async () => {
          if (onRefrescarProfesionales) {
            await onRefrescarProfesionales();
          }
        }}
      />
    </>
  );

  // ==================== RENDERIZADO CONDICIONAL ====================

  function renderCamposSegunTipo() {
    // TAREA_LEVE tiene campos simplificados
    if (tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE) {
      return renderCamposTareaLeve();
    }

    // TRABAJO_EXTRA también campos simplificados
    if (tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_EXTRA) {
      return renderCamposTrabajoExtra();
    }

    // TRADICIONAL y TRABAJO_DIARIO tienen formulario completo
    return renderCamposCompletos();
  }

  function renderCamposTareaLeve() {
    return (
      <div className="card mb-4" style={{ border: 'none', borderRadius: '12px' }}>
        <div
          className="card-header"
          style={{
            background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0'
          }}
        >
          <h6 className="mb-0">
            <i className="fas fa-info-circle me-2"></i>
            Información de la Tarea
          </h6>
        </div>
        <div className="card-body p-4">
          <div className="row">
            <div className="col-md-12 mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-tasks me-2 text-primary"></i>
                Nombre de la Tarea Leve
                <span className="text-danger ms-1">*</span>
              </label>
              <input
                type="text"
                name="nombreObra"
                className="form-control form-control-lg"
                placeholder="Ej: Instalación de sistema eléctrico adicional"
                value={formData.nombreObra}
                onChange={handleChange}
                required
                style={{ borderRadius: '10px', border: '2px solid #e5e7eb' }}
              />
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-dollar-sign me-2 text-success"></i>
                Importe Total
                <span className="text-danger ms-1">*</span>
              </label>
              <div className="input-group">
                <span className="input-group-text bg-success text-white">$</span>
                <input
                  type="number"
                  name="importe"
                  className="form-control form-control-lg"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={formData.importe}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-calendar-day me-2 text-warning"></i>
                Días/Jornales
                <span className="text-danger ms-1">*</span>
              </label>
              <input
                type="number"
                name="diasNecesarios"
                className="form-control form-control-lg"
                placeholder="5"
                min="1"
                value={formData.diasNecesarios}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-calendar-alt me-2 text-info"></i>
                Fecha de Inicio
                <span className="text-danger ms-1">*</span>
              </label>
              <input
                type="date"
                name="fechaInicio"
                className="form-control form-control-lg"
                value={formData.fechaInicio}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-12 mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-align-left me-2 text-primary"></i>
                Descripción
              </label>
              <textarea
                name="descripcion"
                className="form-control"
                rows="3"
                placeholder="Describa los detalles del trabajo..."
                value={formData.descripcion}
                onChange={handleChange}
                style={{ borderRadius: '10px', resize: 'none' }}
              ></textarea>
            </div>

            <div className="col-md-12">
              <label className="form-label fw-bold">
                <i className="fas fa-comment-dots me-2 text-warning"></i>
                Observaciones
              </label>
              <textarea
                name="observaciones"
                className="form-control"
                rows="2"
                placeholder="Notas adicionales, restricciones, etc..."
                value={formData.observaciones}
                onChange={handleChange}
                style={{ borderRadius: '10px', resize: 'none' }}
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCamposTrabajoExtra() {
    // Similar a tarea leve pero con más campos
    return renderCamposCompletos();
  }

  function renderCamposCompletos() {
    return (
      <>
        {/* Nombre de obra */}
        <div className="mb-4">
          <label className="form-label fw-bold">Nombre de la Obra</label>
          <input
            type="text"
            name="nombreObra"
            className="form-control"
            placeholder="Opcional: Se generará desde la dirección si se deja vacío"
            value={formData.nombreObra}
            onChange={handleChange}
            style={{
              borderRadius: '8px',
              padding: '10px 12px',
              border: '3px solid #86b7fe'
            }}
          />
          <small className="text-muted">
            Si se deja vacío, se generará automáticamente desde la Dirección de la obra
          </small>
        </div>

        {/* Dirección */}
        <div className="mb-4">
          <label className="form-label fw-bold">Dirección de la Obra</label>
          <div className="row g-2">
            <div className="col-md-2">
              <label className="form-label small">Calle *</label>
              <input
                name="direccionObraCalle"
                className="form-control"
                placeholder="Av. Libertador"
                required
                value={formData.direccionObraCalle}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Altura *</label>
              <input
                name="direccionObraAltura"
                type="number"
                className="form-control"
                placeholder="1234"
                required
                value={formData.direccionObraAltura}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Barrio</label>
              <input
                name="direccionObraBarrio"
                className="form-control"
                value={formData.direccionObraBarrio}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Torre</label>
              <input
                name="direccionObraTorre"
                className="form-control"
                value={formData.direccionObraTorre}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Piso</label>
              <input
                name="direccionObraPiso"
                className="form-control"
                value={formData.direccionObraPiso}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Depto</label>
              <input
                name="direccionObraDepartamento"
                className="form-control"
                value={formData.direccionObraDepartamento}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
          </div>
        </div>

        {/* Cliente (solo para TRADICIONAL) */}
        {tipoPresupuesto === TIPOS_PRESUPUESTO.TRADICIONAL && (
          <div className="mb-4">
            <label className="form-label fw-bold">Datos del Cliente</label>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label small">Nombre solicitante</label>
                <input
                  name="nombreSolicitante"
                  className="form-control"
                  value={formData.nombreSolicitante}
                  onChange={handleChange}
                  style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Teléfono</label>
                <input
                  name="telefono"
                  className="form-control"
                  value={formData.telefono}
                  onChange={handleChange}
                  style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Dirección particular</label>
                <input
                  name="direccionParticular"
                  className="form-control"
                  value={formData.direccionParticular}
                  onChange={handleChange}
                  style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Mail</label>
                <input
                  name="mail"
                  type="email"
                  className="form-control"
                  value={formData.mail}
                  onChange={handleChange}
                  style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="mb-4">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label fw-bold">Fecha Probable Inicio</label>
              <input
                name="fechaProbableInicio"
                type="date"
                className="form-control"
                value={formData.fechaProbableInicio}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-bold">Vencimiento Presupuesto</label>
              <input
                name="vencimiento"
                type="date"
                className="form-control"
                value={formData.vencimiento}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-bold">Días Hábiles Estimados</label>
              <input
                name="tiempoEstimadoTerminacion"
                type="number"
                className="form-control"
                placeholder="Ej: 30"
                value={formData.tiempoEstimadoTerminacion}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe' }}
              />
            </div>
          </div>
        </div>

        {/* Descripción y observaciones */}
        <div className="mb-4">
          <div className="row">
            <div className="col-md-12 mb-3">
              <label className="form-label fw-bold">Descripción</label>
              <textarea
                name="descripcion"
                className="form-control"
                rows="3"
                value={formData.descripcion}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe', resize: 'none' }}
              ></textarea>
            </div>
            <div className="col-md-12">
              <label className="form-label fw-bold">Observaciones</label>
              <textarea
                name="observaciones"
                className="form-control"
                rows="2"
                value={formData.observaciones}
                onChange={handleChange}
                style={{ borderRadius: '8px', border: '3px solid #86b7fe', resize: 'none' }}
              ></textarea>
            </div>
          </div>
        </div>
      </>
    );
  }
};

export default ModalPresupuestoUnificado;
