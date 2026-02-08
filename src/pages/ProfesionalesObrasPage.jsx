import React from 'react';
import axios from 'axios';
import PlantillaPageLayout from '../components/PlantillaPageLayout';
import SidebarProfesionalesObrasMenu from '../components/SidebarProfesionalesObrasMenu';
import { listarAsignaciones } from '../services/profesionalesObraService';
import api from '../services/api';
// import SeleccionarProfesionalesModal from '../components/SeleccionarProfesionalesModal';
import { Table, Form } from 'react-bootstrap';
import ListarProfesionalesPorTipoModal from '../components/ListarProfesionalesPorTipoModal';
import ProfesionalesPorObraModal from '../components/ProfesionalesPorObraModal';
import { obtenerAsignacionesPorTipo } from '../services/profesionalesObraService';
import ActualizarAsignacionModal from '../components/ActualizarAsignacionModal';
import DesactivarAsignacionModal from '../components/DesactivarAsignacionModal';
// Modales de Caja Chica
import AsignarCajaChicaModal from '../components/AsignarCajaChicaModal';
import ConsultarSaldoCajaChicaModal from '../components/ConsultarSaldoCajaChicaModal';
import DiagnosticoCajaChica from '../components/DiagnosticoCajaChica';
// Modales de Gastos
import RegistrarGastoModal from '../components/RegistrarGastoModal';
import ListarGastosModal from '../components/ListarGastosModal';
import DetalleGastoModal from '../components/DetalleGastoModal';
// Modales de Asistencia
import CheckInModal from '../components/CheckInModal';
import CheckOutModal from '../components/CheckOutModal';
import ListarAsistenciasModal from '../components/ListarAsistenciasModal';
// Notificaciones
import NotificationToast from '../components/NotificationToast';
// Contexto de empresa
import { useEmpresa } from '../EmpresaContext';
// Modales de presupuesto
import ListarTodosPresupuestosModal from '../components/ListarTodosPresupuestosModal';
// Modal de presupuesto
import PresupuestoNoClienteModal from '../components/PresupuestoNoClienteModal';
import HistorialVersionesPresupuestoNoClienteModal from '../components/HistorialVersionesPresupuestoNoClienteModal';


const ProfesionalesObrasPage = () => {
  // Obtener empresa del contexto
  const { empresaSeleccionada } = useEmpresa();

  // Función para normalizar tipo profesional
  const normalizarTipoProfesional = (valor) => {
    if (!valor) return '';
    const normalizado = valor.trim().toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
      .replace(/Ñ/g, 'N');

    // Mapeo de variaciones comunes a los valores exactos que acepta el backend
    const mapeo = {
      'ARQUITECTA': 'ARQUITECTO',
      'INGENIERA': 'INGENIERO',
      'INGENIERA_CIVIL': 'INGENIERO',
      'INGENIERO_CIVIL': 'INGENIERO',
      'MAESTRA_MAYOR_OBRAS': 'MAESTRO_MAYOR_OBRAS',
      'MAESTRA_MAYOR_DE_OBRAS': 'MAESTRO_MAYOR_OBRAS',
      'MAESTRO_MAYOR_DE_OBRAS': 'MAESTRO_MAYOR_OBRAS',
      'ALBANIL': 'OFICIAL_ALBANIL',
      'OFICIAL_ALBANIL': 'OFICIAL_ALBANIL',
      'AYUDANTE_ALBANIL': 'AYUDANTE_ALBANIL',
      'ELECTRICISTA': 'ELECTRICISTA',
      'PLOMERO': 'PLOMERO',
      'GASISTA': 'PLOMERO',
      'CARPINTERO': 'CARPINTERO',
      'PINTOR': 'PINTOR',
      'HERRERO': 'HERRERO',
      'TECNICO': 'TECNICO',
      'TECNICA': 'TECNICO',
      'ENCARGADO_DE_OBRA': 'ENCARGADO_DE_OBRA',
      'ENCARGADA_DE_OBRA': 'ENCARGADO_DE_OBRA',
      'CAPATAZ': 'CAPATAZ'
    };

    return mapeo[normalizado] || normalizado;
  };

  // Función para normalizar rol en obra
  const normalizarRolEnObra = (valor) => {
    if (!valor) return '';
    const normalizado = valor.trim().toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
      .replace(/Ñ/g, 'N');

    // Mapeo de variaciones comunes
    const mapeo = {
      'ENCARGADA': 'ENCARGADO',
      'SUPERVISORA': 'SUPERVISOR',
      'DIRECTORA_OBRA': 'DIRECTOR_OBRA',
      'DIRECTORA_DE_OBRA': 'DIRECTOR_OBRA',
      'DIRECTOR_DE_OBRA': 'DIRECTOR_OBRA'
    };

    return mapeo[normalizado] || normalizado;
  };

  // Estado para la lista de profesionales en el modal múltiple
  const [profesionalesLista, setProfesionalesLista] = React.useState([]);

  // Estados para notificaciones
  const [notification, setNotification] = React.useState({ show: false, message: '', variant: 'success' });

  // Estados para selección de profesional-obra (para caja chica, gastos, asistencia)
  const [profesionalObraSeleccionado, setProfesionalObraSeleccionado] = React.useState(null);

  // Estados para modales de Caja Chica
  const [showAsignarCajaChicaModal, setShowAsignarCajaChicaModal] = React.useState(false);
  const [showConsultarSaldoModal, setShowConsultarSaldoModal] = React.useState(false);
  const [showDiagnosticoCajaChica, setShowDiagnosticoCajaChica] = React.useState(false);

  // Estados para modales de Gastos
  const [showRegistrarGastoModal, setShowRegistrarGastoModal] = React.useState(false);
  const [showListarGastosModal, setShowListarGastosModal] = React.useState(false);
  const [showDetalleGastoModal, setShowDetalleGastoModal] = React.useState(false);
  const [gastoSeleccionado, setGastoSeleccionado] = React.useState(null);

  // Estados para modales de Asistencia
  const [showCheckInModal, setShowCheckInModal] = React.useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = React.useState(false);
  const [showHistorialAsistenciasModal, setShowHistorialAsistenciasModal] = React.useState(false);

  // Maneja acciones del sidebar
  const [showListarPorTipoModal, setShowListarPorTipoModal] = React.useState(false);
  const [showProfesionalesPorObraModal, setShowProfesionalesPorObraModal] = React.useState(false);
  const [showActualizarAsignacionModal, setShowActualizarAsignacionModal] = React.useState(false);
  const [showDesactivarAsignacionModal, setShowDesactivarAsignacionModal] = React.useState(false);
  const [asignacionIdActualizar, setAsignacionIdActualizar] = React.useState('');
  const [empresaIdActualizar, setEmpresaIdActualizar] = React.useState('');

  // Función para mostrar notificaciones
  const showNotification = (message, variant = 'success') => {
    setNotification({ show: true, message, variant });
  };

  const handleSidebarAction = (action) => {
    setActiveAction(action);

    // NUEVAS ACCIONES - PRESUPUESTOS
    if (action === 'historial-versiones') {
      // Abrir modal de selección de obra en modo historial
      setModoSeleccionObra('historial');
      setShowSeleccionarObraModal(true);
      setObraSeleccionada(null);
      cerrarTodosLosModales();
      return;
    }

    if (action === 'listar-presupuestos') {
      // Abrir modal para listar TODOS los presupuestos
      setShowListarPresupuestosModal(true);
      cerrarTodosLosModales();
      return;
    }

    // NUEVAS ACCIONES - CAJA CHICA
    if (action === 'asignar-caja-chica') {
      setShowAsignarCajaChicaModal(true);
      cerrarTodosLosModales();
      return;
    }
    if (action === 'consultar-saldo') {
      setShowConsultarSaldoModal(true);
      cerrarTodosLosModales();
      return;
    }
    if (action === 'diagnostico-caja-chica') {
      setShowDiagnosticoCajaChica(true);
      cerrarTodosLosModales();
      return;
    }

    // NUEVAS ACCIONES - GASTOS
    if (action === 'registrar-gasto') {
      setShowRegistrarGastoModal(true);
      cerrarTodosLosModales();
      return;
    }
    if (action === 'listar-gastos') {
      setShowListarGastosModal(true);
      cerrarTodosLosModales();
      return;
    }

    // NUEVAS ACCIONES - ASISTENCIA
    if (action === 'check-in') {
      setShowCheckInModal(true);
      cerrarTodosLosModales();
      return;
    }
    if (action === 'check-out') {
      setShowCheckOutModal(true);
      cerrarTodosLosModales();
      return;
    }
    if (action === 'historial-asistencias') {
      setShowHistorialAsistenciasModal(true);
      cerrarTodosLosModales();
      return;
    }

    // ACCIONES EXISTENTES
    if (action === 'asignar-profesional-legacy') {
      setShowAsignarModal(true);
      setShowModal(false);
      setShowAsignarMultiplesModal(false);
      setShowListarPorTipoModal(false);
      setShowProfesionalesPorObraModal(false);
      setAsignarError(null);
      setAsignarSuccess(null);
      setAsignarForm({
        profesionalId: '',
        tipoProfesional: '',
        nombre: '',
        obraId: '',
        empresaId: empresaSeleccionada?.id || '',
        fechaDesde: '',
        fechaHasta: '',
        rolEnObra: '',
        valorHoraAsignado: '',
        activo: true
      });
    }
    if (action === 'listar-por-tipo') {
      setShowListarPorTipoModal(true);
      setShowModal(false);
      setShowAsignarModal(false);
      setShowAsignarMultiplesModal(false);
      setShowProfesionalesPorObraModal(false);
    }
    if (action === 'profesionales-por-obra') {
      setShowProfesionalesPorObraModal(true);
      setShowModal(false);
      setShowAsignarModal(false);
      setShowAsignarMultiplesModal(false);
      setShowListarPorTipoModal(false);
    }
    if (action === 'actualizar-asignacion') {
      setShowActualizarAsignacionModal(true);
      setShowModal(false);
      setShowAsignarModal(false);
      setShowAsignarMultiplesModal(false);
      setShowListarPorTipoModal(false);
      setShowProfesionalesPorObraModal(false);
      // Si hay una asignación seleccionada, usarla directamente
      if (selectedAsignacionId) {
        setAsignacionIdActualizar(selectedAsignacionId.toString());
        setEmpresaIdActualizar(empresaSeleccionada?.id?.toString() || '');
      } else {
        // Por defecto, pedir el ID de asignación y empresa
        setAsignacionIdActualizar('');
        setEmpresaIdActualizar('');
      }
    }
    if (action === 'desactivar-asignacion') {
      setShowDesactivarAsignacionModal(true);
      setShowModal(false);
      setShowAsignarModal(false);
      setShowAsignarMultiplesModal(false);
      setShowListarPorTipoModal(false);
      setShowProfesionalesPorObraModal(false);
      setShowActualizarAsignacionModal(false);
      // Si hay una asignación seleccionada, usarla
      if (selectedAsignacionId) {
        setAsignacionIdActualizar(selectedAsignacionId.toString());
        setEmpresaIdActualizar(empresaSeleccionada?.id?.toString() || '');
      } else {
        setAsignacionIdActualizar('');
        setEmpresaIdActualizar('');
      }
    }
  };

  // Función helper para cerrar todos los modales nuevos
  const cerrarTodosLosModales = () => {
    setShowModal(false);
    setShowAsignarModal(false);
    setShowAsignarMultiplesModal(false);
    setShowListarPorTipoModal(false);
    setShowProfesionalesPorObraModal(false);
    setShowActualizarAsignacionModal(false);
    setShowDesactivarAsignacionModal(false);
    setShowHistorialModal(false);
    setShowDiagnosticoCajaChica(false);
  };

  // Handlers de éxito para los nuevos modales
  const handleCajaChicaSuccess = (data) => {
    showNotification(data.mensaje || 'Operación exitosa', 'success');
    // Recargar asignaciones si es necesario
    fetchAsignaciones();
  };

  const handleGastoSuccess = (data) => {
    showNotification(data.mensaje || 'Gasto registrado exitosamente', 'success');
  };

  const handleAsistenciaSuccess = (data) => {
    showNotification(data.mensaje || 'Asistencia registrada exitosamente', 'success');
  };

  const handleVerDetalleGasto = (gasto) => {
    setGastoSeleccionado(gasto);
    setShowListarGastosModal(false);
    setShowDetalleGastoModal(true);
  };

  // Estado para empresas y obras
  const [empresas, setEmpresas] = React.useState([]);
  const [obras, setObras] = React.useState([]);
  // Handler para cerrar el modal de asignar
  const closeAsignarModal = () => {
    setShowAsignarModal(false);
  };
  // Estado para el modal de seleccionar obra
  const [showSeleccionarObraModal, setShowSeleccionarObraModal] = React.useState(false);
  const [obraSeleccionada, setObraSeleccionada] = React.useState(null);
  const [obrasDisponibles, setObrasDisponibles] = React.useState([]);
  const [loadingObras, setLoadingObras] = React.useState(false);
  const [modoSeleccionObra, setModoSeleccionObra] = React.useState('presupuesto'); // 'presupuesto' o 'historial'

  // Estado para el modal de presupuesto
  const [showPresupuestoModal, setShowPresupuestoModal] = React.useState(false);
  const [presupuestoData, setPresupuestoData] = React.useState(null);

  // Estado para el modal de historial de versiones
  const [showHistorialModal, setShowHistorialModal] = React.useState(false);
  const [obraIdHistorial, setObraIdHistorial] = React.useState(null);

  // Estado para el modal de listar todos los presupuestos
  const [showListarPresupuestosModal, setShowListarPresupuestosModal] = React.useState(false);

  // Estado para el modal de asignar profesional (legacy - por si lo necesitamos)
  const [showAsignarModal, setShowAsignarModal] = React.useState(false);
  const [asignarForm, setAsignarForm] = React.useState({
    profesionalId: '',
    tipoProfesional: '',
    nombre: '',
    obraId: '',
    empresaId: '',
    fechaDesde: '',
    fechaHasta: '',
    rolEnObra: '',
    valorHoraAsignado: '',
    activo: true
  });

  // Estado para cargar profesionales del presupuesto
  const [profesionalesPresupuesto, setProfesionalesPresupuesto] = React.useState([]);
  const [loadingPresupuesto, setLoadingPresupuesto] = React.useState(false);
  // Estado para los tipos de profesional
  const [tiposProfesional, setTiposProfesional] = React.useState([]);
  const [profesionalesDisponibles, setProfesionalesDisponibles] = React.useState([]);
  const [asignarLoading, setAsignarLoading] = React.useState(false);
  const [asignarError, setAsignarError] = React.useState(null);
  const [asignarSuccess, setAsignarSuccess] = React.useState(null);
  const [activeAction, setActiveAction] = React.useState(null);
  const [asignaciones, setAsignaciones] = React.useState([]);
  const [selectedAsignacionId, setSelectedAsignacionId] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [showAsignarMultiplesModal, setShowAsignarMultiplesModal] = React.useState(false);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = React.useState([]);
  const [tipoFiltro, setTipoFiltro] = React.useState('');
  const [profesionalesLoading, setProfesionalesLoading] = React.useState(false);
  // Estado para empresas y obras en el modal múltiple
  const [empresasMultiples, setEmpresasMultiples] = React.useState([]);
  const [obrasMultiples, setObrasMultiples] = React.useState([]);
  const [multiplesForm, setMultiplesForm] = React.useState({ empresaId: '', obraId: '', profesionalesIds: [] });
  const [empresaIdInput, setEmpresaIdInput] = React.useState('');
  const [obraIdInput, setObraIdInput] = React.useState('');

  // Precargar empresaIdInput cuando hay empresa seleccionada
  React.useEffect(() => {
    if (empresaSeleccionada?.id) {
      setEmpresaIdInput(empresaSeleccionada.id.toString());
      // También inicializar asignarForm con la empresa
      setAsignarForm(prev => ({
        ...prev,
        empresaId: empresaSeleccionada.id.toString()
      }));
    }
  }, [empresaSeleccionada]);

  // Cargar obras cuando se abre el modal de seleccionar obra
  React.useEffect(() => {
    if (showSeleccionarObraModal && empresaSeleccionada?.id) {
      setLoadingObras(true);
      fetch(`/api/api/obras/empresa/${empresaSeleccionada.id}`)
        .then(res => res.json())
        .then(data => {
          setObrasDisponibles(Array.isArray(data) ? data : []);
          setLoadingObras(false);
        })
        .catch((error) => {
          console.error('Error cargando obras:', error);
          setObrasDisponibles([]);
          setLoadingObras(false);
        });
    }
  }, [showSeleccionarObraModal, empresaSeleccionada]);

  // Sincronización empresa selector/input
  React.useEffect(() => {
    if (multiplesForm.empresaId) {
      setEmpresaIdInput(multiplesForm.empresaId);
    } else if (empresaIdInput) {
      setMultiplesForm(f => ({ ...f, empresaId: empresaIdInput, obraId: '' }));
    }
  }, [multiplesForm.empresaId, empresaIdInput]);
  // Sincronización obra selector/input
  React.useEffect(() => {
    if (multiplesForm.obraId) {
      setObraIdInput(multiplesForm.obraId);
    }
  }, [multiplesForm.obraId, obraIdInput]);
  // Handler para seleccionar profesionales en el modal múltiple
  const handleToggleProfesional = (id) => {
    setMultiplesForm((prev) => {
      const ids = prev.profesionalesIds.includes(id)
        ? prev.profesionalesIds.filter(pid => pid !== id)
        : [...prev.profesionalesIds, id];
      return { ...prev, profesionalesIds: ids };
    });
    setProfesionalesSeleccionados((prev) => {
      return prev.includes(id)
        ? prev.filter(pid => pid !== id)
        : [...prev, id];
    });
  };

  // Handler para submit del modal múltiple
  const handleAsignarMultiplesSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('http://localhost:8080/api/profesionales-obras/asignar-multiples', {
        empresaId: Number(multiplesForm.empresaId),
        obraId: Number(multiplesForm.obraId),
        profesionalesIds: multiplesForm.profesionalesIds.map(Number)
      });
      setShowAsignarMultiplesModal(false);
      setMultiplesForm({ empresaId: '', obraId: '', profesionalesIds: [] });
      setProfesionalesSeleccionados([]);
      fetchAsignaciones();
    } catch (err) {
      alert('Error al asignar múltiples profesionales');
    }
  };

  // Cargar lista de profesionales cuando empresa y obra estén seleccionados
  React.useEffect(() => {
    if (showAsignarMultiplesModal && multiplesForm.empresaId && multiplesForm.obraId) {
      setProfesionalesLoading(true);
      fetch('/api/profesionales')
        .then(res => res.json())
        .then(data => {
          setProfesionalesLista(Array.isArray(data) ? data : []);
          setProfesionalesLoading(false);
        })
        .catch(() => {
          setProfesionalesLista([]);
          setProfesionalesLoading(false);
        });
    } else {
      setProfesionalesLista([]);
    }
  }, [showAsignarMultiplesModal, multiplesForm.empresaId, multiplesForm.obraId]);
  // Cargar empresas al abrir el modal múltiple
  React.useEffect(() => {
    if (showAsignarMultiplesModal) {
      api.get('http://localhost:8080/api/empresas/simple')
        .then(data => {
          let empresas = [];
          if (data && Array.isArray(data.resultado)) {
            empresas = data.resultado;
          } else if (Array.isArray(data)) {
            empresas = data;
          }
          setEmpresasMultiples(empresas);
        })
        .catch(() => setEmpresasMultiples([]));
    }
  }, [showAsignarMultiplesModal]);

  // Cargar obras al seleccionar empresa en el modal múltiple
  React.useEffect(() => {
    if (showAsignarMultiplesModal && multiplesForm.empresaId) {
      api.obras.getPorEmpresa(multiplesForm.empresaId)
        .then(data => setObrasMultiples(Array.isArray(data) ? data : []))
        .catch(() => setObrasMultiples([]));
    } else if (showAsignarMultiplesModal) {
      setObrasMultiples([]);
    }
  }, [showAsignarMultiplesModal, multiplesForm.empresaId]);
  const renderAsignarMultiplesModal = () => {
    return (
      showAsignarMultiplesModal && (
        <div className="modal show d-block">
          <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '900px', width: '99vw'}}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Asignar múltiples profesionales a obra</h5>
                <button type="button" className="btn-close" onClick={() => setShowAsignarMultiplesModal(false)}></button>
              </div>
              <div className="modal-body" style={{padding: '18px 12px 12px 12px'}}>
                <form onSubmit={handleAsignarMultiplesSubmit} style={{display:'flex', flexWrap:'wrap', gap:'18px 18px', justifyContent:'space-between'}}>
                  <div style={{display:'flex', gap:'18px', width:'100%'}}>
                    <div className="mb-2" style={{flex:'1 1 50%'}}>
                      <label className="form-label">ID Empresa
                        <input
                          required
                          className="form-control"
                          autoComplete="off"
                          type="number"
                          value={empresaIdInput}
                          name="empresaId"
                          disabled={true}
                          readOnly
                        />
                      </label>
                    </div>
                    <div className="mb-2" style={{flex:'1 1 50%'}}>
                      <label className="form-label">Nombre de Empresa
                        <input
                          type="text"
                          className="form-control"
                          value={empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || ''}
                          disabled={true}
                          readOnly
                        />
                      </label>
                    </div>
                  </div>
                  <div style={{display:'flex', gap:'18px', width:'100%'}}>
                    <div className="mb-2" style={{flex:'1 1 50%'}}>
                      <label className="form-label">Obra por nombre
                        <select name="obraSelector" className="form-select" value={multiplesForm.obraId} onChange={e => setMultiplesForm(f => ({...f, obraId: e.target.value}))} disabled={!multiplesForm.empresaId}>
                          <option value="">{!multiplesForm.empresaId ? 'Seleccione primero una empresa' : 'Seleccione obra'}</option>
                          {multiplesForm.empresaId && obrasMultiples && obrasMultiples.length > 0 && obrasMultiples.map(obra => (
                            <option key={obra.id} value={obra.id}>{obra.nombreObra || obra.nombre || `Obra #${obra.id}`}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mb-2" style={{flex:'1 1 50%'}}>
                      <label className="form-label">ID Obra
                        <input
                          required
                          className="form-control"
                          autoComplete="off"
                          type="number"
                          value={obraIdInput}
                          name="obraId"
                          onChange={e => setObraIdInput(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                  {/* Lista de profesionales solo si empresa y obra están seleccionados */}
                  {multiplesForm.empresaId && multiplesForm.obraId && (
                    <div className="mb-2" style={{flex:'1 1 100%'}}>
                      <label className="form-label">Seleccionar profesionales:</label>
                      {/* Filtro por tipo profesional */}
                      <div className="mb-2" style={{maxWidth: 320}}>
                        <select className="form-select" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
                          <option value="">Todos los tipos</option>
                          {[...new Set(profesionalesLista.map(p => p.tipoProfesional).filter(Boolean))].map(tipo => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </div>
                      {profesionalesLoading ? (
                        <div className="text-center my-2">Cargando profesionales...</div>
                      ) : (
                        <Table striped bordered hover>
                          <thead>
                            <tr>
                              <th></th>
                              <th>Tipo profesional</th>
                              <th>Especialidad</th>
                              <th>Nombre</th>
                              <th>Teléfono</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profesionalesLista.filter(prof => !tipoFiltro || prof.tipoProfesional === tipoFiltro).length > 0 ? profesionalesLista.filter(prof => !tipoFiltro || prof.tipoProfesional === tipoFiltro).map(prof => (
                              <tr key={prof.id}>
                                <td>
                                  <Form.Check
                                    type="checkbox"
                                    checked={multiplesForm.profesionalesIds.includes(prof.id)}
                                    onChange={() => handleToggleProfesional(prof.id)}
                                  />
                                </td>
                                <td>{prof.tipoProfesional || '-'}</td>
                                <td>{prof.especialidad}</td>
                                <td>{prof.nombre}</td>
                                <td>{prof.telefono || '-'}</td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={5} className="text-center">No hay profesionales disponibles</td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                      )}
                    </div>
                  )}
                  <div className="mb-2" style={{flex:'1 1 100%'}}>
                    <label className="form-label">Profesionales seleccionados:</label>
                    <ul>
                      {profesionalesLista.filter(prof => multiplesForm.profesionalesIds.includes(prof.id)).map(prof => (
                        <li key={prof.id}>{prof.nombre} ({prof.especialidad})</li>
                      ))}
                    </ul>
                  </div>
                  <button type="submit" className="btn btn-primary w-100 fw-bold" style={{flex:'1 1 100%', maxWidth: 300, alignSelf: 'center'}}>
                    Asignar múltiples profesionales
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )
    );
  }

  // Handler para cambios en el formulario
  const handleAsignarChange = async (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'empresaSelector') {
      setAsignarForm((prev) => ({ ...prev, empresaId: value }));
      return;
    }
    if (name === 'obraSelector') {
      setAsignarForm((prev) => ({ ...prev, obraId: value }));
      // Cargar profesionales del presupuesto de esta obra
      if (value && asignarForm.empresaId) {
        cargarProfesionalesPresupuesto(asignarForm.empresaId, value);
      }
      return;
    }
    setAsignarForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Si cambia el tipo profesional, cargar profesionales disponibles
    if (name === 'tipoProfesional') {
      setAsignarForm((prev) => ({ ...prev, profesionalId: '', nombre: '' })); // Limpiar selección anterior y nombre
      if (value) {
        fetch(`/api/profesionales/por-tipo?tipoProfesional=${encodeURIComponent(value)}`)
          .then(res => res.json())
          .then(data => {
            setProfesionalesDisponibles(Array.isArray(data) ? data : []);
          })
          .catch(() => setProfesionalesDisponibles([]));
      } else {
        setProfesionalesDisponibles([]);
      }
    }
    // Si cambia el profesional, autocompletar el nombre y el rol en obra
    if (name === 'profesionalId') {
      const seleccionado = profesionalesDisponibles.find(p => String(p.id) === String(value));
      setAsignarForm((prev) => ({
        ...prev,
        nombre: seleccionado ? seleccionado.nombre : '',
        rolEnObra: seleccionado && seleccionado.especialidad ? seleccionado.especialidad : ''
      }));
    }
  };

  // Función para cargar profesionales del presupuesto de una obra
  const cargarProfesionalesPresupuesto = async (empresaId, obraId) => {
    setLoadingPresupuesto(true);
    try {
      const response = await api.get(`http://localhost:8080/api/presupuestos/por-obra-version?empresaId=${empresaId}&obraId=${obraId}`);
      if (response && response.profesionales && Array.isArray(response.profesionales)) {
        setProfesionalesPresupuesto(response.profesionales);
      } else {
        setProfesionalesPresupuesto([]);
      }
    } catch (error) {
      console.error('Error cargando profesionales del presupuesto:', error);
      setProfesionalesPresupuesto([]);
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  // Handler para cuando se selecciona un presupuesto del listado completo
  const handleSeleccionarPresupuestoDelListado = (presupuesto) => {
    console.log('✅ Presupuesto seleccionado del listado:', presupuesto);
    console.log('🔴 Cerrando modal de listar...');

    // Cerrar el modal de listado primero
    setShowListarPresupuestosModal(false);

    console.log('🟢 Modal de listar cerrado, esperando 100ms...');

    // Pequeño delay para asegurar que el modal anterior se cierre completamente
    setTimeout(() => {
      console.log('🟡 Abriendo modal de edición...');
      setPresupuestoData(presupuesto);
      setShowPresupuestoModal(true);
      console.log('🟢 Modal de edición abierto');
    }, 100);
  };

  // Handler para cuando se selecciona una obra en el modal de selección
  const handleSeleccionarObra = async () => {
    if (!obraSeleccionada) {
      setAsignarError('Debe seleccionar una obra');
      return;
    }

    // Si el modo es historial, abrir el modal de historial directamente
    if (modoSeleccionObra === 'historial') {
      console.log('📚 Abriendo historial de versiones para obra ID:', obraSeleccionada.id);
      setObraIdHistorial(obraSeleccionada.id);
      setShowSeleccionarObraModal(false);
      setShowHistorialModal(true);
      setObraSeleccionada(null);
      return;
    }

    // Modo presupuesto (comportamiento original)
    try {
      setLoadingPresupuesto(true);
      setAsignarError(null);

      // Intentar cargar el presupuesto de la obra seleccionada
      const response = await api.get(`http://localhost:8080/api/presupuestos/por-obra-version?empresaId=${empresaSeleccionada.id}&obraId=${obraSeleccionada.id}`);

      console.log('✅ Presupuesto encontrado:', response);
      console.log('📋 Profesionales en presupuesto:', response.profesionales);
      console.log('📦 Materiales en presupuesto:', response.materiales);
      console.log('💰 Otros costos en presupuesto:', response.otrosCostos);

      // Si existe el presupuesto, lo cargamos
      setPresupuestoData(response);
      setShowSeleccionarObraModal(false);
      setShowPresupuestoModal(true);
    } catch (error) {
      console.error('❌ Error cargando presupuesto:', error);
      console.log('📊 Datos de la petición:', {
        empresaId: empresaSeleccionada.id,
        obraId: obraSeleccionada.id,
        obraCompleta: obraSeleccionada
      });
      console.log('🔍 Respuesta del error:', error.response);

      // Si el error es 404 (presupuesto no encontrado), crear uno nuevo
      if (error.response?.status === 404 || error.status === 404 || error.message?.includes('No se encontró')) {
        console.log('📝 No existe presupuesto para esta obra, creando uno nuevo...');
        console.log('🏗️ Datos de la obra seleccionada:', obraSeleccionada);

        // Preparar datos iniciales para nuevo presupuesto con la obra seleccionada
        const today = new Date().toISOString().slice(0, 10);
        const nuevoPresupuestoData = {
          idEmpresa: empresaSeleccionada.id,
          // Usar los campos de la obra para pre-llenar el presupuesto
          direccionObraCalle: obraSeleccionada.calle || obraSeleccionada.direccion || obraSeleccionada.nombreObra || obraSeleccionada.nombre || '',
          direccionObraAltura: obraSeleccionada.altura || '',
          direccionObraPiso: obraSeleccionada.piso || '',
          direccionObraDepartamento: obraSeleccionada.departamento || '',
          // Campos vacíos por defecto
          nombreSolicitante: '',
          direccionParticular: '',
          descripcion: obraSeleccionada.descripcion || '',
          telefono: '',
          mail: '',
          fechaProbableInicio: today,
          vencimiento: today,
          fechaCreacion: today,
          tiempoEstimadoTerminacion: '',
          version: 1,
          estado: 'A enviar',
          observaciones: '',
          profesionales: [],
          materiales: [],
          otrosCostos: [],
          honorarioDireccionValorFijo: '',
          honorarioDireccionPorcentaje: '',
          // Guardar referencia a la obra (útil para debug)
          _obraId: obraSeleccionada.id,
          _nombreObra: obraSeleccionada.nombreObra || obraSeleccionada.nombre || obraSeleccionada.direccion
        };

        console.log('✅ Presupuesto nuevo creado:', nuevoPresupuestoData);
        setPresupuestoData(nuevoPresupuestoData);
        setShowSeleccionarObraModal(false);
        setShowPresupuestoModal(true);
      } else {
        // Otro tipo de error
        setAsignarError('Error al conectar con el servidor. Intente nuevamente.');
      }
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  // Handler para submit del formulario
  const handleAsignarSubmit = async (e) => {
    e.preventDefault();
    setAsignarLoading(true);
    setAsignarError(null);
    setAsignarSuccess(null);
    try {
      // Preparar el payload con campos normalizados
      const payload = {
        tipoProfesional: normalizarTipoProfesional(asignarForm.tipoProfesional),
        nombre: asignarForm.nombre.trim(),
        obraId: Number(asignarForm.obraId),
        empresaId: Number(asignarForm.empresaId),
        fechaDesde: asignarForm.fechaDesde,
        fechaHasta: asignarForm.fechaHasta,
        rolEnObra: normalizarRolEnObra(asignarForm.rolEnObra),
        valorHoraAsignado: Number(asignarForm.valorHoraAsignado),
        activo: asignarForm.activo
      };

      // Agregar profesionalId solo si existe
      if (asignarForm.profesionalId) {
        payload.profesionalId = Number(asignarForm.profesionalId);
      }

      const resp = await api.post('http://localhost:8080/api/profesionales-obras/asignar', payload);
      setAsignarSuccess('Profesional asignado correctamente.');
      setAsignarLoading(false);
      fetchAsignaciones(); // Recargar la tabla
    } catch (err) {
      setAsignarError('Error al asignar profesional.');
      setAsignarLoading(false);
    }
  };
  // Modal para asignar profesional a obra
  function renderAsignarModal() {
    return showAsignarModal && (
      <div className="modal show d-block">
        <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '900px', width: '99vw'}}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Asignar profesional a obra</h5>
              <button type="button" className="btn-close" onClick={closeAsignarModal}></button>
            </div>
            <div className="modal-body" style={{padding: '18px 12px 12px 12px'}}>
              <form onSubmit={handleAsignarSubmit} style={{display:'flex', flexWrap:'wrap', gap:'18px 18px', justifyContent:'space-between'}}>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">Tipo Profesional
                    <input
                      name="tipoProfesional"
                      value={asignarForm.tipoProfesional}
                      onChange={handleAsignarChange}
                      required
                      className="form-control"
                      autoComplete="off"
                      placeholder="Ej: ARQUITECTO, INGENIERO"
                      list="tiposProfesionalesList"
                    />
                    <datalist id="tiposProfesionalesList">
                      <option value="ARQUITECTO">Arquitecto</option>
                      <option value="INGENIERO">Ingeniero</option>
                      <option value="MAESTRO_MAYOR_OBRAS">Maestro Mayor de Obras</option>
                      <option value="ELECTRICISTA">Electricista</option>
                      <option value="PLOMERO">Plomero</option>
                      <option value="ALBANIL">Albañil</option>
                      <option value="CARPINTERO">Carpintero</option>
                      <option value="PINTOR">Pintor</option>
                      <option value="HERRERO">Herrero</option>
                      <option value="TECNICO">Técnico</option>
                    </datalist>
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">Profesional ID (opcional)
                    <input name="profesionalId" type="number" value={asignarForm.profesionalId} onChange={handleAsignarChange} className="form-control" autoComplete="off" placeholder="Dejar vacío para nuevo" />
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">Nombre
                    <input name="nombre" value={asignarForm.nombre} onChange={handleAsignarChange} required className="form-control" autoComplete="off" placeholder="Nombre del profesional" />
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">ID Empresa
                    <input name="empresaId" type="number" value={asignarForm.empresaId} onChange={handleAsignarChange} required className="form-control" autoComplete="off" disabled={true} />
                  </label>
                  <label className="form-label" style={{marginTop:'4px'}}>Nombre de Empresa
                    <input
                      type="text"
                      className="form-control"
                      value={empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || ''}
                      disabled={true}
                      readOnly
                    />
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">ID Obra
                    <input name="obraId" type="number" value={asignarForm.obraId} onChange={handleAsignarChange} required className="form-control" autoComplete="off" />
                  </label>
                  <label className="form-label" style={{marginTop:'4px'}}>Obra por nombre
                    <select name="obraSelector" value={asignarForm.obraId} onChange={handleAsignarChange} className="form-select" disabled={!asignarForm.empresaId}>
                      <option value="">{!asignarForm.empresaId ? 'Seleccione primero una empresa' : 'Seleccione obra'}</option>
                      {obras.map((obra) => (
                        <option key={obra.id} value={obra.id}>{obra.nombre}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Mostrar profesionales del presupuesto si hay obra seleccionada */}
                {asignarForm.obraId && (
                  <div className="mb-3" style={{flex:'1 1 100%', marginTop: '20px'}}>
                    <h6 className="mb-3" style={{borderBottom: '2px solid #0866c6', paddingBottom: '8px'}}>
                      Profesionales en el Presupuesto de esta Obra
                    </h6>
                    {loadingPresupuesto ? (
                      <div className="text-center my-3">Cargando profesionales del presupuesto...</div>
                    ) : profesionalesPresupuesto.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>Tipo</th>
                              <th>Nombre</th>
                              <th>Modo Pago</th>
                              <th>Importe</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profesionalesPresupuesto.map((prof, index) => (
                              <tr key={index}>
                                <td>{prof.tipoProfesional || '-'}</td>
                                <td>{prof.nombre || '-'}</td>
                                <td>{prof.modoPago || '-'}</td>
                                <td>${prof.importe || 0}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                      setAsignarForm(prev => ({
                                        ...prev,
                                        tipoProfesional: prof.tipoProfesional || '',
                                        nombre: prof.nombre || '',
                                        rolEnObra: prof.tipoProfesional || '',
                                        valorHoraAsignado: prof.importe || ''
                                      }));
                                    }}
                                  >
                                    Usar datos
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info">
                        Esta obra no tiene profesionales en su presupuesto. Puede agregar uno manualmente abajo.
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">Fecha Desde
                    <input name="fechaDesde" type="date" value={asignarForm.fechaDesde} onChange={handleAsignarChange} required className="form-control" />
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">Fecha Hasta
                    <input name="fechaHasta" type="date" value={asignarForm.fechaHasta} onChange={handleAsignarChange} required className="form-control" />
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 30%'}}>
                  <label className="form-label">Rol en Obra
                    <input
                      name="rolEnObra"
                      value={asignarForm.rolEnObra}
                      onChange={handleAsignarChange}
                      required
                      className="form-control"
                      autoComplete="off"
                      placeholder="Ej: ENCARGADO, OFICIAL"
                      list="rolesObraList"
                    />
                    <datalist id="rolesObraList">
                      <option value="ENCARGADO">Encargado</option>
                      <option value="CAPATAZ">Capataz</option>
                      <option value="OFICIAL">Oficial</option>
                      <option value="AYUDANTE">Ayudante</option>
                      <option value="MAESTRO_MAYOR">Maestro Mayor</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="DIRECTOR_OBRA">Director de Obra</option>
                      <option value="PROFESIONAL">Profesional</option>
                      <option value="ESPECIALISTA">Especialista</option>
                      <option value="OPERARIO">Operario</option>
                    </datalist>
                  </label>
                </div>
                <div className="mb-2" style={{flex:'1 1 48%'}}>
                  <label className="form-label">Valor Hora Asignado
                    <input name="valorHoraAsignado" type="number" value={asignarForm.valorHoraAsignado} onChange={handleAsignarChange} required className="form-control" autoComplete="off" />
                  </label>
                </div>
                <div className="form-check mb-2" style={{flex:'1 1 100%'}}>
                  <input name="activo" type="checkbox" checked={asignarForm.activo} onChange={handleAsignarChange} className="form-check-input" id="activoCheck" />
                  <label className="form-check-label" htmlFor="activoCheck">Activo</label>
                </div>
                {asignarError && <div style={{color:'red', marginBottom:8, flex:'1 1 100%'}}>{asignarError}</div>}
                {asignarSuccess && <div style={{color:'green', marginBottom:8, flex:'1 1 100%'}}>{asignarSuccess}</div>}
                <button type="submit" disabled={asignarLoading} className="btn btn-primary w-100 fw-bold" style={{flex:'1 1 100%', maxWidth: 300, alignSelf: 'center'}}>
                  {asignarLoading ? 'Asignando...' : 'Asignar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Cargar empresas y obras al abrir el modal de asignar
  React.useEffect(() => {
    if (showAsignarModal) {
      api.empresas.getAll()
        .then(data => setEmpresas(Array.isArray(data) ? data : []))
        .catch(() => setEmpresas([]));
    }
  }, [showAsignarModal]);

  // Cargar obras solo cuando hay empresa seleccionada y el modal está abierto
  React.useEffect(() => {
    if (showAsignarModal && asignarForm.empresaId) {
      import('../services/api').then(({ default: api }) => {
        api.obras.getPorEmpresa(asignarForm.empresaId)
          .then(data => setObras(Array.isArray(data) ? data : []))
          .catch(() => setObras([]));
      });
    } else if (showAsignarModal) {
      setObras([]);
    }
  }, [showAsignarModal, asignarForm.empresaId]);

  // Cargar asignaciones al montar la página para la tabla principal
  React.useEffect(() => {
    fetchAsignaciones();
  }, []);

  // Cargar tipos de profesional al abrir el modal de asignar (siempre desde el endpoint real)
  React.useEffect(() => {
    if (showAsignarModal) {
      fetch('/api/profesionales/tipos-disponibles')
        .then(res => res.json())
        .then(tipos => {
          setTiposProfesional(Array.isArray(tipos) ? tipos : []);
        })
      setProfesionalesDisponibles([]);
    }
  }, [showAsignarModal]);
  // Llama al endpoint para listar asignaciones
  const fetchAsignaciones = async () => {
    setLoading(true);
    setError(null);
    try {
      const empresaId = empresaSeleccionada?.id;
      if (!empresaId) {
        setError('Debe seleccionar una empresa');
        setLoading(false);
        return;
      }
      const resp = await listarAsignaciones(empresaId);
      console.log('📋 Respuesta listarAsignaciones:', resp);

      // Intentar diferentes formatos de respuesta
      let asignacionesArray = [];
      if (Array.isArray(resp)) {
        asignacionesArray = resp;
      } else if (Array.isArray(resp.data)) {
        asignacionesArray = resp.data;
      } else if (resp.datos && Array.isArray(resp.datos)) {
        asignacionesArray = resp.datos;
      } else if (resp.content && Array.isArray(resp.content)) {
        asignacionesArray = resp.content;
      }

      console.log('📋 Asignaciones procesadas:', asignacionesArray.length, 'items');
      if (asignacionesArray.length > 0) {
        console.log('🔍 Estructura primera asignación - TODOS LOS CAMPOS:');
        console.log('  Campos disponibles:', Object.keys(asignacionesArray[0]));
        console.log('  Objeto completo:', JSON.stringify(asignacionesArray[0], null, 2));
      }
      setAsignaciones(asignacionesArray);
    } catch (e) {
      console.error('Error cargando asignaciones:', e);
      setError('Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  };

  // Cargar asignaciones automáticamente cuando hay empresa seleccionada
  React.useEffect(() => {
    if (empresaSeleccionada?.id) {
      fetchAsignaciones();
    }
  }, [empresaSeleccionada?.id]);

  // Modal para mostrar la planilla de asignaciones
  const [showModal, setShowModal] = React.useState(false);
  // Ya no es necesario abrir el modal por defecto

  const closeModal = () => {
    setShowModal(false);
    setActiveAction(null);
  };

  const obtenerNombreObraAsignacion = (asignacion) => {
    if (!asignacion) return '-';

    return (
      asignacion.nombreTrabajoExtra ||
      asignacion.trabajoExtraNombre ||
      asignacion.nombreTrabajoExtraObra ||
      asignacion.trabajoExtra ||
      asignacion.nombreObra ||
      '-'
    );
  };

  // Tabla reutilizable
  const AsignacionesTable = () => (
  <div style={{marginTop:32, marginLeft: '40px', paddingLeft: '0px', width: 'calc(100% - 40px)'}} onClick={() => setSelectedAsignacionId(null)}>
      <h3 style={{marginBottom:24}}>Asignaciones profesionales-obra</h3>
      {loading && <div>Cargando...</div>}
      {error && <div style={{color: 'red'}}>{error}</div>}
      {!loading && !error && Array.isArray(asignaciones) && (
        <div className="table-responsive" style={{width: '100%'}} onClick={(e) => e.stopPropagation()}>
          <table className="table table-bordered table-striped" style={{width: '100%'}}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Profesional</th>
                <th>Tipo</th>
                <th>Obra</th>
                <th>Dirección</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Activo</th>
                <th>Creación</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.length === 0 && (
                <tr><td colSpan={9} className="text-center">No existen profesionales asignados a una obra</td></tr>
              )}
              {asignaciones.map(a => {
                const asignacionId = a.idAsignacion;
                const isSelected = selectedAsignacionId && asignacionId && selectedAsignacionId === asignacionId;

                return (
                <tr
                  key={asignacionId}
                  onClick={() => {
                    // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                    if (isSelected) {
                      setSelectedAsignacionId(null);
                    } else {
                      setSelectedAsignacionId(asignacionId);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  className={isSelected ? 'table-primary' : ''}
                >
                  <td>
                    {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                    {asignacionId}
                  </td>
                  <td>{a.nombreProfesional}</td>
                  <td>{a.tipoProfesional}</td>
                  <td>{obtenerNombreObraAsignacion(a)}</td>
                  <td>{a.direccionObra}</td>
                  <td>{a.fechaDesde}</td>
                  <td>{a.fechaHasta}</td>
                  <td>{a.activo ? 'Sí' : 'No'}</td>
                  <td>{a.fechaCreacion}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Modal con la tabla
  const renderAsignacionesModal = () => (
    showModal && (
      <div style={{position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.35)', zIndex:2000, display:'flex', alignItems:'flex-start', justifyContent:'flex-end'}}>
        <div style={{background:'#fff', borderRadius:10, maxWidth:'95vw', width:'1200px', maxHeight:'90vh', overflow:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', padding:32, position:'relative', marginTop:'20vh', marginRight:'1vw'}}>
          <button onClick={closeModal} style={{position:'absolute', top:16, right:16, fontSize:22, background:'none', border:'none', cursor:'pointer'}} title="Cerrar">×</button>
          <AsignacionesTable />
        </div>
      </div>
    )
  );

  return (
    <PlantillaPageLayout sidebar={<SidebarProfesionalesObrasMenu onAction={handleSidebarAction} /> }>
  <h2 style={{textAlign: 'center', width: '100%'}}>Página de Profesionales y Obras</h2>

  {/* Notificaciones */}
  <NotificationToast
    show={notification.show}
    message={notification.message}
    variant={notification.variant}
    onClose={() => setNotification({ ...notification, show: false })}
  />

  {/* Selector de Profesional-Obra para modales nuevos */}
  {(showAsignarCajaChicaModal || showConsultarSaldoModal || showRegistrarGastoModal ||
    showListarGastosModal || showCheckInModal || showCheckOutModal || showHistorialAsistenciasModal) && (
    <div style={{ marginTop: 20, marginLeft: 40, padding: 20, background: '#f8f9fa', borderRadius: 8, maxWidth: 600 }}>
      <h5>Seleccionar Profesional Asignado</h5>
      <Form.Group>
        <Form.Label>Seleccione una asignación profesional-obra:</Form.Label>
        <Form.Select
          value={profesionalObraSeleccionado?.idAsignacion || ''}
          onChange={(e) => {
            const asignacion = asignaciones.find(a => a.idAsignacion === parseInt(e.target.value));
            setProfesionalObraSeleccionado(asignacion || null);
          }}
        >
          <option value="">-- Seleccione una asignación --</option>
          {asignaciones.map((asig) => (
            <option key={asig.idAsignacion} value={asig.idAsignacion}>
              ID:{asig.idAsignacion} | {asig.nombreProfesional} ({asig.tipoProfesional}) - {asig.direccionObra}
            </option>
          ))}
        </Form.Select>
        {profesionalObraSeleccionado && (
          <div className="mt-2 p-2 bg-white border rounded">
            <small>
              <strong>Profesional:</strong> {profesionalObraSeleccionado.nombreProfesional}<br/>
              <strong>Obra:</strong> {profesionalObraSeleccionado.direccionObra}<br/>
              <strong>Tipo:</strong> {profesionalObraSeleccionado.tipoProfesional}
            </small>
          </div>
        )}
      </Form.Group>
    </div>
  )}

  {/* Tabla principal siempre visible */}
  <AsignacionesTable />
  {/* Modal si se activa desde el sidebar */}
  {showListarPorTipoModal ? (
    <ListarProfesionalesPorTipoModal
      show={showListarPorTipoModal}
      onClose={() => setShowListarPorTipoModal(false)}
    />
  ) : showProfesionalesPorObraModal ? (
    <ProfesionalesPorObraModal
      show={showProfesionalesPorObraModal}
      onClose={() => setShowProfesionalesPorObraModal(false)}
    />
  ) : showActualizarAsignacionModal ? (
    <ActualizarAsignacionModal
      show={showActualizarAsignacionModal}
      onClose={() => setShowActualizarAsignacionModal(false)}
      asignacionId={asignacionIdActualizar}
      empresaId={empresaIdActualizar}
    />
  ) : showDesactivarAsignacionModal ? (
    <DesactivarAsignacionModal
      show={showDesactivarAsignacionModal}
      onClose={() => setShowDesactivarAsignacionModal(false)}
      asignacionId={asignacionIdActualizar}
      empresaId={empresaIdActualizar}
    />
  ) : (
    <>
      {renderAsignacionesModal()}
      {renderAsignarModal()}
      {renderAsignarMultiplesModal()}
    </>
  )}

  {/* NUEVOS MODALES - CAJA CHICA */}
  <AsignarCajaChicaModal
    show={showAsignarCajaChicaModal}
    onHide={() => setShowAsignarCajaChicaModal(false)}
    onSuccess={handleCajaChicaSuccess}
    profesionalObraId={profesionalObraSeleccionado?.idAsignacion}
    profesionalNombre={profesionalObraSeleccionado?.nombreProfesional}
    direccionObra={profesionalObraSeleccionado?.direccionObra}
  />

  <ConsultarSaldoCajaChicaModal
    show={showConsultarSaldoModal}
    onHide={() => setShowConsultarSaldoModal(false)}
  />

  <DiagnosticoCajaChica
    show={showDiagnosticoCajaChica}
    onHide={() => setShowDiagnosticoCajaChica(false)}
  />

  {/* NUEVOS MODALES - GASTOS */}
  <RegistrarGastoModal
    show={showRegistrarGastoModal}
    onHide={() => setShowRegistrarGastoModal(false)}
    onSuccess={handleGastoSuccess}
    profesionalObraId={profesionalObraSeleccionado?.idAsignacion}
    profesionalNombre={profesionalObraSeleccionado?.nombreProfesional}
    direccionObra={profesionalObraSeleccionado?.direccionObra}
  />

  <ListarGastosModal
    show={showListarGastosModal}
    onHide={() => setShowListarGastosModal(false)}
    profesionalObraId={profesionalObraSeleccionado?.idAsignacion}
    profesionalNombre={profesionalObraSeleccionado?.nombreProfesional}
    direccionObra={profesionalObraSeleccionado?.direccionObra}
    onVerDetalle={handleVerDetalleGasto}
  />

  <DetalleGastoModal
    show={showDetalleGastoModal}
    onHide={() => {
      setShowDetalleGastoModal(false);
      setShowListarGastosModal(true);
    }}
    gastoSeleccionado={gastoSeleccionado}
  />

  {/* NUEVOS MODALES - ASISTENCIA */}
  <CheckInModal
    show={showCheckInModal}
    onHide={() => setShowCheckInModal(false)}
    onSuccess={handleAsistenciaSuccess}
    profesionalObraId={profesionalObraSeleccionado?.idAsignacion}
    profesionalNombre={profesionalObraSeleccionado?.nombreProfesional}
    direccionObra={profesionalObraSeleccionado?.direccionObra}
  />

  <CheckOutModal
    show={showCheckOutModal}
    onHide={() => setShowCheckOutModal(false)}
    onSuccess={handleAsistenciaSuccess}
    profesionalObraId={profesionalObraSeleccionado?.idAsignacion}
    profesionalNombre={profesionalObraSeleccionado?.nombreProfesional}
    direccionObra={profesionalObraSeleccionado?.direccionObra}
  />

  <ListarAsistenciasModal
    show={showHistorialAsistenciasModal}
    onHide={() => setShowHistorialAsistenciasModal(false)}
    profesionalObraId={profesionalObraSeleccionado?.idAsignacion}
    profesionalNombre={profesionalObraSeleccionado?.nombreProfesional}
    direccionObra={profesionalObraSeleccionado?.direccionObra}
  />

  {/* Modal para seleccionar obra */}
  {showSeleccionarObraModal && (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {modoSeleccionObra === 'historial'
                ? '📚 Seleccionar Obra para Ver Historial'
                : 'Seleccionar Obra'}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setShowSeleccionarObraModal(false)}
            ></button>
          </div>
          <div className="modal-body">
            {/* Empresa ID (disabled) */}
            <div className="mb-3">
              <label className="form-label">ID Empresa</label>
              <input
                type="text"
                className="form-control"
                value={empresaSeleccionada?.id || ''}
                disabled
              />
            </div>

            {/* Empresa Nombre (disabled) */}
            <div className="mb-3">
              <label className="form-label">Empresa</label>
              <input
                type="text"
                className="form-control"
                value={empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || ''}
                disabled
              />
            </div>

            {/* Selector de Obra */}
            <div className="mb-3">
              <label className="form-label">Obra *</label>
              <select
                className="form-select"
                value={obraSeleccionada?.id || ''}
                onChange={(e) => {
                  const obra = obrasDisponibles.find(o => o.id === Number(e.target.value));
                  console.log('🏗️ Obra seleccionada:', obra);
                  setObraSeleccionada(obra || null);
                }}
                disabled={loadingObras}
              >
                <option value="">
                  {loadingObras ? 'Cargando obras...' : (obrasDisponibles.length === 0 ? 'No hay obras disponibles' : 'Seleccione una obra...')}
                </option>
                {obrasDisponibles.map((obra) => (
                  <option key={obra.id} value={obra.id}>
                    {obra.nombreObra || obra.nombre || obra.direccion || `Obra #${obra.id}`}
                  </option>
                ))}
              </select>
            </div>

            {asignarError && (
              <div className="alert alert-danger">{asignarError}</div>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSeleccionarObraModal(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSeleccionarObra}
              disabled={!obraSeleccionada || loadingPresupuesto}
            >
              {loadingPresupuesto
                ? 'Cargando...'
                : modoSeleccionObra === 'historial'
                  ? '📚 Ver Historial'
                  : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Modal de Presupuesto */}
  {showPresupuestoModal && (
    <PresupuestoNoClienteModal
      show={showPresupuestoModal}
      onClose={() => {
        setShowPresupuestoModal(false);
        setPresupuestoData(null);
        setObraSeleccionada(null);
      }}
      onSave={async (presupuesto) => {
        try {
          // Determinar si estamos creando una nueva versión basada en una existente
          const hasExistingVersion = presupuestoData?.id;

          if (hasExistingVersion) {
            // Si hay un presupuesto existente, crear NUEVA versión (no reemplazar)
            // Incrementar la versión automáticamente
            presupuesto.version = (presupuestoData.version || 1) + 1;
            console.log(`📝 Creando nueva versión ${presupuesto.version} del presupuesto para ${presupuesto.direccionObraCalle}`);

            // Eliminar el ID para que el backend cree un nuevo registro
            delete presupuesto.id;

            // POST para crear nueva versión (historial de versiones)
            await api.post('/api/v1/presupuestos-no-cliente', presupuesto);
            setAsignarSuccess(`Nueva versión creada correctamente (Versión ${presupuesto.version})`);
          } else {
            // Si es completamente nuevo (primera vez para esta obra)
            presupuesto.version = presupuesto.version || 1;
            console.log('✨ Creando primer presupuesto, versión: 1');

            // POST para crear nuevo presupuesto
            await api.post('/api/v1/presupuestos-no-cliente', presupuesto);
            setAsignarSuccess('Presupuesto creado correctamente (Versión 1)');
          }

          // Cerrar modal y limpiar estados
          setShowPresupuestoModal(false);
          setPresupuestoData(null);
          setObraSeleccionada(null);

          console.log('✅ Presupuesto guardado exitosamente con historial de versiones');
        } catch (error) {
          console.error('❌ Error guardando presupuesto:', error);

          // Mostrar mensaje de error detallado
          const errorMsg = error.response?.data?.message || error.message || 'Error desconocido';
          setAsignarError(`Error al guardar el presupuesto: ${errorMsg}`);
        }
      }}
      initialData={presupuestoData}
    />
  )}

  {/* Modal de Historial de Versiones */}
  {showHistorialModal && (
    <HistorialVersionesPresupuestoNoClienteModal
      show={showHistorialModal}
      handleClose={() => {
        setShowHistorialModal(false);
        setObraIdHistorial(null);
      }}
      obraIdInicial={obraIdHistorial}
      empresaIdInicial={empresaSeleccionada?.id}
    />
  )}

  {/* Modal de Listar Todos los Presupuestos */}
  {showListarPresupuestosModal && (
    <ListarTodosPresupuestosModal
      show={showListarPresupuestosModal}
      handleClose={() => setShowListarPresupuestosModal(false)}
      onSeleccionarPresupuesto={handleSeleccionarPresupuestoDelListado}
    />
  )}

  </PlantillaPageLayout>  );
}

export default ProfesionalesObrasPage;
