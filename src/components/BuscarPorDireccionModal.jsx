import React, { useState, useRef, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import apiService from '../services/api';

/**
 * Modal de Búsqueda Específica para Presupuestos No Cliente
 * - Permite filtrar por múltiples campos combinables
 * - Los campos vacíos se ignoran (opcionales)
 * - Los campos completados se combinan con AND
 */
const BusquedaAvanzadaPresupuestosModal = ({ show, onClose, onSelectPresupuesto, onFiltrosGuardados, onResultadosFiltrados }) => {
  const { empresaSeleccionada } = useEmpresa();
  
  // Ref para auto-scroll a resultados
  const resultadosRef = useRef(null);
  
  const [form, setForm] = useState({
    // 📍 Dirección de Obra (6 campos: Barrio, Calle, Altura, Torre, Piso, Departamento)
    direccionObraBarrio: '',
    direccionObraCalle: '',
    direccionObraAltura: '',
    direccionObraTorre: '',
    direccionObraPiso: '',
    direccionObraDepartamento: '',
    
    // � Datos del Solicitante (4 campos según backend)
    nombreSolicitante: '',
    telefono: '',
    mail: '',
    direccionParticular: '',
    
    // 🏢 Datos del Presupuesto (4 campos según backend)
    numeroPresupuesto: '',
    estado: '',
    numeroVersion: '',
    descripcion: '',
    
    // 📅 Fechas (8 campos según backend)
    fechaEmisionDesde: '',
    fechaEmisionHasta: '',
    fechaCreacionDesde: '',
    fechaCreacionHasta: '',
    fechaProbableInicioDesde: '',
    fechaProbableInicioHasta: '',
    vencimientoDesde: '',
    vencimientoHasta: '',
    
    // 💰 Montos (6 campos según backend)
    totalGeneralMinimo: '',
    totalGeneralMaximo: '',
    totalProfesionalesMinimo: '',
    totalProfesionalesMaximo: '',
    totalMaterialesMinimo: '',
    totalMaterialesMaximo: '',
    
    // � Configuración (2 campos según backend)
    tipoProfesionalPresupuesto: '',
    modoPresupuesto: ''
  });
  
  const [resultados, setResultados] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleBuscar = async (e) => {
    e.preventDefault();
    
    // Construir objeto de filtros solo con campos completados
    const filtros = {};
    
    // 📍 Dirección de Obra (7 campos)
    if (form.nombreObra.trim()) filtros.nombreObra = form.nombreObra.trim();
    if (form.direccionObraBarrio.trim()) filtros.direccionObraBarrio = form.direccionObraBarrio.trim();
    if (form.direccionObraCalle.trim()) filtros.direccionObraCalle = form.direccionObraCalle.trim();
    if (form.direccionObraAltura.trim()) filtros.direccionObraAltura = form.direccionObraAltura.trim();
    if (form.direccionObraTorre.trim()) filtros.direccionObraTorre = form.direccionObraTorre.trim();
    if (form.direccionObraPiso.trim()) filtros.direccionObraPiso = form.direccionObraPiso.trim();
    if (form.direccionObraDepartamento.trim()) filtros.direccionObraDepartamento = form.direccionObraDepartamento.trim();
    
    // 👤 Datos del Solicitante (4 campos)
    if (form.nombreSolicitante.trim()) filtros.nombreSolicitante = form.nombreSolicitante.trim();
    if (form.telefono.trim()) filtros.telefono = form.telefono.trim();
    if (form.mail.trim()) filtros.mail = form.mail.trim();
    if (form.direccionParticular.trim()) filtros.direccionParticular = form.direccionParticular.trim();
    
    // 🏢 Datos del Presupuesto (4 campos)
    if (form.numeroPresupuesto.trim()) filtros.numeroPresupuesto = Number(form.numeroPresupuesto.trim());
    if (form.estado.trim()) filtros.estado = form.estado.trim();
    if (form.numeroVersion.trim()) filtros.numeroVersion = Number(form.numeroVersion.trim());
    if (form.descripcion.trim()) filtros.descripcion = form.descripcion.trim();
    
    // 📅 Fechas (8 campos)
    if (form.fechaEmisionDesde) filtros.fechaEmisionDesde = form.fechaEmisionDesde;
    if (form.fechaEmisionHasta) filtros.fechaEmisionHasta = form.fechaEmisionHasta;
    if (form.fechaCreacionDesde) filtros.fechaCreacionDesde = form.fechaCreacionDesde;
    if (form.fechaCreacionHasta) filtros.fechaCreacionHasta = form.fechaCreacionHasta;
    if (form.fechaProbableInicioDesde) filtros.fechaProbableInicioDesde = form.fechaProbableInicioDesde;
    if (form.fechaProbableInicioHasta) filtros.fechaProbableInicioHasta = form.fechaProbableInicioHasta;
    if (form.vencimientoDesde) filtros.vencimientoDesde = form.vencimientoDesde;
    if (form.vencimientoHasta) filtros.vencimientoHasta = form.vencimientoHasta;
    
    // 💰 Montos (6 campos)
    if (form.totalGeneralMinimo) filtros.totalGeneralMinimo = Number(form.totalGeneralMinimo);
    if (form.totalGeneralMaximo) filtros.totalGeneralMaximo = Number(form.totalGeneralMaximo);
    if (form.totalProfesionalesMinimo) filtros.totalProfesionalesMinimo = Number(form.totalProfesionalesMinimo);
    if (form.totalProfesionalesMaximo) filtros.totalProfesionalesMaximo = Number(form.totalProfesionalesMaximo);
    if (form.totalMaterialesMinimo) filtros.totalMaterialesMinimo = Number(form.totalMaterialesMinimo);
    if (form.totalMaterialesMaximo) filtros.totalMaterialesMaximo = Number(form.totalMaterialesMaximo);
    
    // 🔧 Configuración (2 campos)
    if (form.tipoProfesionalPresupuesto.trim()) filtros.tipoProfesionalPresupuesto = form.tipoProfesionalPresupuesto.trim();
    if (form.modoPresupuesto.trim()) filtros.modoPresupuesto = form.modoPresupuesto.trim();
    
    // Validar que al menos un filtro esté completo
    if (Object.keys(filtros).length === 0) {
      setError('Debe completar al menos un campo de búsqueda');
      setSearching(false);
      return;
    }

    setSearching(true);
    setError(null);
    setSearched(false);

    try {
      console.log('🔍 Búsqueda específica con filtros:', filtros);
      console.log('📤 Enviando búsqueda avanzada con empresaId:', empresaSeleccionada?.id);
      
      // Usar búsqueda avanzada del backend si está disponible
      const response = await apiService.presupuestosNoCliente.busquedaAvanzada(
        filtros,
        empresaSeleccionada?.id
      );
      
      console.log('✅ Presupuestos obtenidos:', response);
      
      // Extraer datos según estructura de respuesta del backend
      let resultadosBusqueda = [];
      if (Array.isArray(response)) {
        resultadosBusqueda = response;
      } else if (response?.datos && Array.isArray(response.datos)) {
        resultadosBusqueda = response.datos;
      } else if (response?.content && Array.isArray(response.content)) {
        resultadosBusqueda = response.content;
      } else if (response?.data && Array.isArray(response.data)) {
        resultadosBusqueda = response.data;
      }
      
      console.log(`✅ Resultados de búsqueda: ${resultadosBusqueda.length}`);
      
      if (resultadosBusqueda.length === 0) {
        console.warn('⚠️ No se encontraron presupuestos con los filtros:', filtros);
        console.warn('💡 Intenta buscar con menos filtros o verifica que existan presupuestos APROBADOS');
      }
      
      setResultados(resultadosBusqueda);
      setSearched(true);
      
      // NO hacer scroll automático - dejar al usuario en el formulario
      
      // Devolver los resultados para uso externo
      return resultadosBusqueda;
      
    } catch (err) {
      console.error('❌ Error en búsqueda específica:', err);
      
      // Error específico si el método no está implementado
      if (err.response?.data?.mensaje?.includes('no implementado')) {
        setError(
          'La búsqueda avanzada aún no está implementada en el backend. ' +
          'Por favor, contacta al desarrollador del backend para que implemente el método busquedaAvanzada() ' +
          'en PresupuestoNoClienteService.java. ' +
          '\n\nMientras tanto, puedes cargar presupuestos directamente si conoces el ID.'
        );
      } else {
        setError(err.response?.data?.mensaje || err.response?.data?.message || err.message || 'Error al buscar presupuestos');
      }
      setResultados([]);
      setSearched(true);
      return []; // Devolver array vacío en caso de error
    } finally {
      setSearching(false);
    }
  };

  const handleGuardarFiltrosPorDefecto = () => {
    // Guardar los filtros actuales en localStorage
    try {
      const filtrosGuardar = {};
      
      // Solo guardar campos con valor
      Object.keys(form).forEach(key => {
        if (form[key] && form[key].toString().trim() !== '') {
          filtrosGuardar[key] = form[key];
        }
      });
      
      if (Object.keys(filtrosGuardar).length === 0) {
        alert('⚠️ No hay filtros para guardar. Complete al menos un campo.');
        return;
      }
      
      localStorage.setItem('presupuestos_filtros_por_defecto', JSON.stringify(filtrosGuardar));
      alert('✅ Filtros guardados como configuración por defecto.\n\nLa próxima vez que abra esta página, se aplicarán automáticamente estos filtros.');
      
      // Notificar al componente padre que se guardaron filtros
      if (onFiltrosGuardados) {
        onFiltrosGuardados(filtrosGuardar);
      }
      
      // Cerrar modal
      onClose();
      
    } catch (error) {
      console.error('Error guardando filtros por defecto:', error);
      alert('❌ Error al guardar los filtros');
    }
  };

  const handleLimpiarFiltrosPorDefecto = () => {
    if (window.confirm('¿Desea eliminar la configuración de filtros por defecto?\n\nLa próxima vez que abra esta página, se cargarán todos los presupuestos.')) {
      localStorage.removeItem('presupuestos_filtros_por_defecto');
      alert('✅ Configuración de filtros eliminada');
      handleLimpiar();
    }
  };

  const handleLimpiar = () => {
    setForm({
      // 📍 Dirección de Obra
      nombreObra: '',
      direccionObraBarrio: '',
      direccionObraCalle: '',
      direccionObraAltura: '',
      direccionObraTorre: '',
      direccionObraPiso: '',
      direccionObraDepartamento: '',
      
      // 👤 Datos del Solicitante
      nombreSolicitante: '',
      telefono: '',
      mail: '',
      direccionParticular: '',
      
      // 🏢 Datos del Presupuesto
      numeroPresupuesto: '',
      estado: '',
      numeroVersion: '',
      descripcion: '',
      
      // 📅 Fechas
      fechaEmisionDesde: '',
      fechaEmisionHasta: '',
      fechaCreacionDesde: '',
      fechaCreacionHasta: '',
      fechaProbableInicioDesde: '',
      fechaProbableInicioHasta: '',
      vencimientoDesde: '',
      vencimientoHasta: '',
      
      // 💰 Montos
      totalGeneralMinimo: '',
      totalGeneralMaximo: '',
      totalProfesionalesMinimo: '',
      totalProfesionalesMaximo: '',
      totalMaterialesMinimo: '',
      totalMaterialesMaximo: '',
      
      // � Configuración
      tipoProfesionalPresupuesto: '',
      modoPresupuesto: ''
    });
    setResultados([]);
    setSearched(false);
    setError(null);
  };

  const handleSelectPresupuesto = (presupuesto) => {
    console.log('✅ Presupuesto seleccionado:', presupuesto);
    if (onSelectPresupuesto) {
      onSelectPresupuesto(presupuesto);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-funnel-fill me-2"></i>
              Búsqueda Específica de Presupuestos
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
              disabled={searching}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body">
            <div className="alert alert-info mb-4">
              <i className="bi bi-info-circle-fill me-2"></i>
              <strong>Instrucciones:</strong> Todos los campos son opcionales. <u>Puedes ingresar varios valores en cada campo</u>, separados por coma o salto de línea (Ejemplo: Calle1, Calle2, Calle3). Los campos vacíos serán ignorados. Si escribes varios valores en un campo, se mostrarán los resultados que coincidan con <u>cualquiera</u> de esos valores. Los filtros de diferentes campos se combinan (deben cumplirse todos los criterios ingresados).
            </div>

            {/* Formulario de búsqueda */}
            <form onSubmit={handleBuscar}>
              {/* ========== SECCIÓN 1: DIRECCIÓN DE OBRA ========== */}
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-geo-alt-fill me-2"></i>
                    Dirección de Obra
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    {/* Primera fila: Nombre de la Obra */}
                    <div className="col-md-12">
                      <label className="form-label fw-semibold text-dark">Nombre de la Obra</label>
                      <input
                        type="text"
                        name="nombreObra"
                        className="form-control form-control-sm"
                        value={form.nombreObra}
                        onChange={handleChange}
                        placeholder="Ej: Refacción Oficinas, Ampliación Casa..."
                        disabled={searching}
                      />
                    </div>

                    {/* Segunda fila: Barrio, Calle - más anchos */}
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Barrio</label>
                      <input
                        type="text"
                        name="direccionObraBarrio"
                        className="form-control form-control-sm"
                        value={form.direccionObraBarrio}
                        onChange={handleChange}
                        placeholder="Ej: Palermo"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Calle</label>
                      <input
                        type="text"
                        name="direccionObraCalle"
                        className="form-control form-control-sm"
                        value={form.direccionObraCalle}
                        onChange={handleChange}
                        placeholder="Ej: Av. Libertador"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Altura</label>
                      <input
                        type="text"
                        name="direccionObraAltura"
                        className="form-control form-control-sm"
                        value={form.direccionObraAltura}
                        onChange={handleChange}
                        placeholder="1234"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Torre</label>
                      <input
                        type="text"
                        name="direccionObraTorre"
                        className="form-control form-control-sm"
                        value={form.direccionObraTorre}
                        onChange={handleChange}
                        placeholder="A, B, 1..."
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-1">
                      <label className="form-label fw-semibold text-dark">Piso</label>
                      <input
                        type="text"
                        name="direccionObraPiso"
                        className="form-control form-control-sm"
                        value={form.direccionObraPiso}
                        onChange={handleChange}
                        placeholder="5"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-1">
                      <label className="form-label fw-semibold text-dark">Depto</label>
                      <input
                        type="text"
                        name="direccionObraDepartamento"
                        className="form-control form-control-sm"
                        value={form.direccionObraDepartamento}
                        onChange={handleChange}
                        placeholder="A"
                        disabled={searching}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========== SECCIÓN 2: DATOS DEL SOLICITANTE ========== */}
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-person-fill me-2"></i>
                    Datos del Solicitante
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold text-dark">Nombre del Solicitante</label>
                      <input
                        type="text"
                        name="nombreSolicitante"
                        className="form-control form-control-sm"
                        value={form.nombreSolicitante}
                        onChange={handleChange}
                        placeholder="Ej: Juan Pérez"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Teléfono</label>
                      <input
                        type="text"
                        name="telefono"
                        className="form-control form-control-sm"
                        value={form.telefono}
                        onChange={handleChange}
                        placeholder="1234567890"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-5">
                      <label className="form-label fw-semibold text-dark">Email</label>
                      <input
                        type="email"
                        name="mail"
                        className="form-control form-control-sm"
                        value={form.mail}
                        onChange={handleChange}
                        placeholder="ejemplo@mail.com"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="form-label fw-semibold text-dark">Dirección Particular</label>
                      <input
                        type="text"
                        name="direccionParticular"
                        className="form-control form-control-sm"
                        value={form.direccionParticular}
                        onChange={handleChange}
                        placeholder="Ej: Av. Corrientes 1234, CABA"
                        disabled={searching}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========== SECCIÓN 3: DATOS DEL PRESUPUESTO ========== */}
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-file-earmark-text-fill me-2"></i>
                    Datos del Presupuesto
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Nro. Presupuesto</label>
                      <input
                        type="number"
                        name="numeroPresupuesto"
                        className="form-control form-control-sm"
                        value={form.numeroPresupuesto}
                        onChange={handleChange}
                        placeholder="123"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Estado</label>
                      <select
                        name="estado"
                        className="form-select form-select-sm"
                        value={form.estado}
                        onChange={handleChange}
                        disabled={searching}
                      >
                        <option value="">Todos los estados</option>
                        <option value="NO_CLIENTE">No Cliente</option>
                        <option value="MODIFICADO">Modificado</option>
                        <option value="APROBADO">Aprobado</option>
                        <option value="RECHAZADO">Rechazado</option>
                        <option value="EN_REVISION">En Revisión</option>
                      </select>
                    </div>

                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Nro. Versión</label>
                      <input
                        type="number"
                        name="numeroVersion"
                        className="form-control form-control-sm"
                        value={form.numeroVersion}
                        onChange={handleChange}
                        placeholder="2"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-5">
                      <label className="form-label fw-semibold text-dark">Descripción</label>
                      <input
                        type="text"
                        name="descripcion"
                        className="form-control form-control-sm"
                        value={form.descripcion}
                        onChange={handleChange}
                        placeholder="Palabras clave..."
                        disabled={searching}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========== SECCIÓN 4: FECHAS ========== */}
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-calendar-range-fill me-2"></i>
                    Fechas (Rangos)
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Fecha de Emisión</label>
                      <label className="form-label text-muted small">Desde</label>
                      <input
                        type="date"
                        name="fechaEmisionDesde"
                        className="form-control form-control-sm"
                        value={form.fechaEmisionDesde}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Hasta</label>
                      <input
                        type="date"
                        name="fechaEmisionHasta"
                        className="form-control form-control-sm"
                        value={form.fechaEmisionHasta}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Fecha de Creación</label>
                      <label className="form-label text-muted small">Desde</label>
                      <input
                        type="date"
                        name="fechaCreacionDesde"
                        className="form-control form-control-sm"
                        value={form.fechaCreacionDesde}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Hasta</label>
                      <input
                        type="date"
                        name="fechaCreacionHasta"
                        className="form-control form-control-sm"
                        value={form.fechaCreacionHasta}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Fecha Probable Inicio</label>
                      <label className="form-label text-muted small">Desde</label>
                      <input
                        type="date"
                        name="fechaProbableInicioDesde"
                        className="form-control form-control-sm"
                        value={form.fechaProbableInicioDesde}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Hasta</label>
                      <input
                        type="date"
                        name="fechaProbableInicioHasta"
                        className="form-control form-control-sm"
                        value={form.fechaProbableInicioHasta}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">Vencimiento</label>
                      <label className="form-label text-muted small">Desde</label>
                      <input
                        type="date"
                        name="vencimientoDesde"
                        className="form-control form-control-sm"
                        value={form.vencimientoDesde}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Hasta</label>
                      <input
                        type="date"
                        name="vencimientoHasta"
                        className="form-control form-control-sm"
                        value={form.vencimientoHasta}
                        onChange={handleChange}
                        disabled={searching}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========== SECCIÓN 5: MONTOS ========== */}
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-currency-dollar me-2"></i>
                    Montos (Rangos)
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Total General</label>
                      <label className="form-label text-muted small">Mínimo</label>
                      <input
                        type="number"
                        name="totalGeneralMinimo"
                        className="form-control form-control-sm"
                        value={form.totalGeneralMinimo}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Máximo</label>
                      <input
                        type="number"
                        name="totalGeneralMaximo"
                        className="form-control form-control-sm"
                        value={form.totalGeneralMaximo}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Total Profesionales</label>
                      <label className="form-label text-muted small">Mínimo</label>
                      <input
                        type="number"
                        name="totalProfesionalesMinimo"
                        className="form-control form-control-sm"
                        value={form.totalProfesionalesMinimo}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Máximo</label>
                      <input
                        type="number"
                        name="totalProfesionalesMaximo"
                        className="form-control form-control-sm"
                        value={form.totalProfesionalesMaximo}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">Total Materiales</label>
                      <label className="form-label text-muted small">Mínimo</label>
                      <input
                        type="number"
                        name="totalMaterialesMinimo"
                        className="form-control form-control-sm"
                        value={form.totalMaterialesMinimo}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        disabled={searching}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-semibold text-dark">&nbsp;</label>
                      <label className="form-label text-muted small">Máximo</label>
                      <input
                        type="number"
                        name="totalMaterialesMaximo"
                        className="form-control form-control-sm"
                        value={form.totalMaterialesMaximo}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        disabled={searching}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========== SECCIÓN 6: CONFIGURACIÓN ========== */}
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-primary">
                    <i className="bi bi-gear-fill me-2"></i>
                    Configuración
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-dark">Tipo Profesional Presupuesto</label>
                      <input
                        type="text"
                        name="tipoProfesionalPresupuesto"
                        className="form-control form-control-sm"
                        value={form.tipoProfesionalPresupuesto}
                        onChange={handleChange}
                        placeholder="Ej: Arquitecto"
                        disabled={searching}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-dark">Modo Presupuesto</label>
                      <input
                        type="text"
                        name="modoPresupuesto"
                        className="form-control form-control-sm"
                        value={form.modoPresupuesto}
                        onChange={handleChange}
                        placeholder="Ej: DETALLADO"
                        disabled={searching}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="d-flex gap-2 justify-content-between mb-3">
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={handleGuardarFiltrosPorDefecto}
                    disabled={searching}
                    title="Guarda los filtros actuales para que se apliquen automáticamente al abrir la página"
                  >
                    <i className="bi bi-bookmark-star-fill me-2"></i>
                    Guardar como Filtro por Defecto
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={handleLimpiarFiltrosPorDefecto}
                    disabled={searching}
                    title="Elimina la configuración de filtros por defecto"
                  >
                    <i className="bi bi-trash3-fill me-2"></i>
                    Eliminar Configuración
                  </button>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleLimpiar}
                    disabled={searching}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Limpiar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={searching}
                  >
                    {searching ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Buscando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Buscar
                    </>
                  )}
                </button>
                </div>
              </div>
            </form>

            <hr />

            {/* Resultados */}
            {error && (
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}

            {searched && !error && resultados.length === 0 && (
              null
            )}

            {resultados.length > 0 && (
              <div ref={resultadosRef}>
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-list-check me-2"></i>
                  Resultados encontrados: {resultados.length}
                </h6>
                
                <div className="table-responsive">
                  <table className="table table-hover table-striped">
                    <thead className="table-dark">
                      <tr>
                        <th>ID</th>
                        <th>Presupuesto #</th>
                        <th>Versión</th>
                        <th>Dirección</th>
                        <th>Estado</th>
                        <th>Solicitante</th>
                        <th>Monto Total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((p) => {
                        const direccion = [
                          p.direccionObraBarrio ? `${p.direccionObraBarrio},` : '',
                          p.direccionObraCalle,
                          p.direccionObraAltura,
                          p.direccionObraTorre ? `Torre ${p.direccionObraTorre}` : '',
                          p.direccionObraPiso ? `Piso ${p.direccionObraPiso}` : '',
                          p.direccionObraDepartamento ? `Depto ${p.direccionObraDepartamento}` : ''
                        ].filter(Boolean).join(' ');

                        return (
                          <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{p.numeroPresupuesto || 'N/A'}</td>
                            <td>
                              <span className="badge bg-info">v{p.numeroVersion || p.version || 1}</span>
                            </td>
                            <td>{direccion}</td>
                            <td>
                              <span className={`badge ${
                                p.estado === 'APROBADO' ? 'bg-success' :
                                p.estado === 'MODIFICADO' ? 'bg-warning text-dark' :
                                p.estado === 'A_ENVIAR' ? 'bg-primary' :
                                'bg-secondary'
                              }`}>
                                {p.estado || 'BORRADOR'}
                              </span>
                            </td>
                            <td>{p.nombreSolicitante || 'N/A'}</td>
                            <td className="fw-bold">
                              ${(p.montoTotal || p.totalGeneral || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleSelectPresupuesto(p)}
                              >
                                <i className="bi bi-eye me-1"></i>
                                Ver
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={searching}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-lg btn-primary"
              onClick={async (e) => {
                const resultadosBusqueda = await handleBuscar(e);
                // Si hay resultados y callback definido, pasar resultados al layout y cerrar
                if (resultadosBusqueda && resultadosBusqueda.length > 0 && onResultadosFiltrados) {
                  onResultadosFiltrados(resultadosBusqueda);
                  onClose();
                }
              }}
              disabled={searching}
              style={{
                minWidth: '200px',
                fontWeight: '600',
                borderRadius: '25px'
              }}
            >
              {searching ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Filtrando...
                </>
              ) : (
                <>
                  <i className="bi bi-funnel-fill me-2"></i>
                  Mostrar Resultados
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusquedaAvanzadaPresupuestosModal;
