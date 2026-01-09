import React, { useState, useEffect } from 'react';
import { formatearMoneda } from '../services/cajaChicaService';
import { useEmpresa } from '../EmpresaContext';
import api, { cajaChicaAPI } from '../services/api';

const AsignarCajaChicaModal = ({ show, onHide, onSuccess, profesionalObraId: profesionalObraIdProp, profesionalNombre: profesionalNombreProp, direccionObra: direccionObraProp }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [monto, setMonto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para selectores
  const [obras, setObras] = useState([]);
  const [obraSeleccionada, setObraSeleccionada] = useState('');
  const [presupuestos, setPresupuestos] = useState([]);
  const [profesionalesDisponibles, setProfesionalesDisponibles] = useState([]);
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState(null);

  // Cargar obras al abrir modal
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarObras();
      cargarPresupuestos();
    }
  }, [show, empresaSeleccionada]);

  const cargarObras = async () => {
    try {
      const response = await api.obras.getPorEmpresa(empresaSeleccionada.id);
      setObras(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Error cargando obras:', err);
    }
  };

  const cargarPresupuestos = async () => {
    try {
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const lista = Array.isArray(response) ? response : (response.datos || response.content || []);
      setPresupuestos(lista);
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
    }
  };

  // Cargar profesionales cuando se selecciona una obra
  useEffect(() => {
    if (obraSeleccionada && presupuestos.length > 0) {
      cargarProfesionalesDeObra();
    } else {
      setProfesionalesDisponibles([]);
      setProfesionalSeleccionado(null);
    }
  }, [obraSeleccionada, presupuestos]);

  const cargarProfesionalesDeObra = () => {
    const obra = obras.find(o => o.id == obraSeleccionada);
    if (!obra) return;

    // Extraer dirección de la obra
    let obraCalle = obra.calle || '';
    let obraAltura = obra.altura || '';
    
    if (!obraCalle && obra.nombreObra) {
      const match = obra.nombreObra.match(/Obra\s+(.+?)\s+(\d+)/i);
      if (match) {
        obraCalle = match[1].trim();
        obraAltura = match[2];
      }
    }

    // Buscar presupuestos de esa obra
    const presupuestosDeObra = presupuestos.filter(p => {
      const pCalle = (p.direccionObraCalle || '').toLowerCase().trim();
      const pAltura = (p.direccionObraAltura || '').toString().trim();
      const oCalle = obraCalle.toLowerCase().trim();
      const oAltura = obraAltura.toString().trim();
      
      const calleMatch = pCalle.includes(oCalle) || oCalle.includes(pCalle);
      const alturaMatch = !oAltura || pAltura === oAltura;
      
      return calleMatch && alturaMatch;
    });

    // Extraer profesionales
    const profesionalesUnicos = new Map();
    presupuestosDeObra.forEach(presupuesto => {
      try {
        const profesionales = presupuesto.profesionales_json || presupuesto.profesionalesJson || [];
        const profesionalesArray = typeof profesionales === 'string' 
          ? JSON.parse(profesionales) 
          : profesionales;
        
        if (Array.isArray(profesionalesArray)) {
          profesionalesArray.forEach(prof => {
            const nombre = (prof.nombre || prof.nombreProfesional || '').trim();
            const tipo = (prof.tipo || prof.tipoProfesional || '').trim();
            const profId = `${nombre}_${tipo}`.toLowerCase();
            
            if (!profesionalesUnicos.has(profId)) {
              profesionalesUnicos.set(profId, {
                id: profId,
                nombre: nombre,
                tipo: tipo,
                presupuestoId: presupuesto.id
              });
            }
          });
        }
      } catch (err) {
        console.error('Error parseando profesionales:', err);
      }
    });

    setProfesionalesDisponibles(Array.from(profesionalesUnicos.values()));
  };

  useEffect(() => {
    if (show) {
      setMonto('');
      setError(null);
      setObraSeleccionada(profesionalObraIdProp ? '' : '');
      setProfesionalSeleccionado(null);
    }
  }, [show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!monto || parseFloat(monto) <= 0) {
      setError('Debe ingresar un monto mayor a 0');
      return;
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    if (!obraSeleccionada) {
      setError('Debe seleccionar una obra');
      return;
    }

    if (!profesionalSeleccionado) {
      setError('Debe seleccionar un profesional');
      return;
    }

    setLoading(true);

    try {
      // Buscar el presupuesto correspondiente
      const presupuesto = presupuestos.find(p => p.id === profesionalSeleccionado.presupuestoId);
      
      if (!presupuesto) {
        setError('No se encontró el presupuesto asociado');
        setLoading(false);
        return;
      }

      console.log('💰 ========== ASIGNAR CAJA CHICA (NUEVA API - TABLA RELACIONAL) ==========');
      console.log('📦 Presupuesto ID:', presupuesto.id);
      console.log('👤 Profesional:', profesionalSeleccionado.nombre, '-', profesionalSeleccionado.tipo);
      console.log('💵 Monto:', parseFloat(monto));

      // Preparar datos para la nueva API
      const data = {
        presupuestoId: presupuesto.id,
        profesionalNombre: profesionalSeleccionado.nombre,
        profesionalTipo: profesionalSeleccionado.tipo,
        tipo: 'ASIGNACION',
        monto: parseFloat(monto),
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Caja chica asignada a ${profesionalSeleccionado.nombre} (${profesionalSeleccionado.tipo})`,
        usuarioRegistro: empresaSeleccionada.nombre || 'Sistema'
      };

      console.log('📤 POST /api/v1/caja-chica/asignar');

      // Llamar a la nueva API de tabla relacional
      const response = await cajaChicaAPI.asignar(data, empresaSeleccionada.id);
      
      console.log('✅ GUARDADO EN TABLA caja_chica_movimientos');
      console.log('  ✓ ID:', response.id);
      console.log('  ✓ Tipo:', response.tipo);
      console.log('  ✓ Monto:', response.monto);
      console.log('  ✓ Fecha:', response.fecha);
      console.log('  ✓ Backup automático en JSONB: otros_costos_json');
      console.log('🎉 ============================================================');

      // Notificar éxito
      if (onSuccess) {
        onSuccess({
          mensaje: `Caja chica de ${formatearMoneda(parseFloat(monto))} asignada a ${profesionalSeleccionado.nombre}`,
          datos: { presupuestoId: presupuesto.id, monto: parseFloat(monto), movimientoId: response.id }
        });
      }

      // Limpiar formulario y cerrar
      setMonto('');
      setProfesionalSeleccionado(null);
      setObraSeleccionada('');
      onHide();
      
    } catch (err) {
      console.error('❌ ERROR asignando caja chica:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message ||
        'Error al asignar caja chica. Por favor intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '500px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">💰 Asignar Caja Chica</h5>
            <button type="button" className="btn-close" onClick={onHide} disabled={loading}></button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {!profesionalObraIdProp && (
              <div className="alert alert-warning">
                <strong>⚠️ Funcionalidad en desarrollo</strong>
                <p className="mb-0 mt-2">
                  Para asignar caja chica, el profesional debe estar formalmente asignado a la obra en el sistema. 
                  Los profesionales de presupuestos aún no tienen esta asignación formal.
                </p>
                <p className="mb-0 mt-2">
                  <small><strong>Próximamente:</strong> Se agregará la funcionalidad para crear asignaciones automáticamente.</small>
                </p>
              </div>
            )}

            <div className="mb-3 p-2 bg-light rounded">
              <strong>Empresa:</strong> {empresaSeleccionada?.nombre || empresaSeleccionada?.nombreEmpresa || 'No seleccionada'}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">
                  Obra <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={obraSeleccionada}
                  onChange={(e) => setObraSeleccionada(e.target.value)}
                  required
                  disabled={loading || profesionalObraIdProp}
                >
                  <option value="">Seleccione una obra</option>
                  {obras.map(obra => (
                    <option key={obra.id} value={obra.id}>
                      {obra.nombreObra || obra.nombre || `Obra #${obra.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Profesional <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={profesionalSeleccionado ? JSON.stringify(profesionalSeleccionado) : ''}
                  onChange={(e) => {
                    const prof = e.target.value ? JSON.parse(e.target.value) : null;
                    setProfesionalSeleccionado(prof);
                  }}
                  required
                  disabled={loading || !obraSeleccionada || profesionalesDisponibles.length === 0 || profesionalObraIdProp}
                >
                  <option value="">
                    {!obraSeleccionada 
                      ? 'Primero seleccione una obra' 
                      : profesionalesDisponibles.length === 0 
                        ? 'No hay profesionales en esta obra'
                        : 'Seleccione un profesional'
                    }
                  </option>
                  {profesionalesDisponibles.map((prof, idx) => (
                    <option key={idx} value={JSON.stringify(prof)}>
                      {prof.nombre} ({prof.tipo})
                    </option>
                  ))}
                </select>
                {profesionalesDisponibles.length > 0 && (
                  <div className="form-text text-muted">
                    {profesionalesDisponibles.length} profesional(es) disponible(s)
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Monto a Asignar <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Ej: 50000"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                  disabled={loading}
                  style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                />
                <div className="form-text text-muted">
                  Ingrese el monto en pesos (ARS)
                </div>
              </div>

              {monto && parseFloat(monto) > 0 && (
                <div className="alert alert-info">
                  <strong>Monto a asignar:</strong> {formatearMoneda(parseFloat(monto))}
                </div>
              )}
            </form>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </button>
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={handleSubmit} 
              disabled={loading || !monto || parseFloat(monto) <= 0 || !obraSeleccionada || !profesionalSeleccionado}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Asignando...
                </>
              ) : (
                '✓ Asignar Caja Chica'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsignarCajaChicaModal;
