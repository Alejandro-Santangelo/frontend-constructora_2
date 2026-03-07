import React, { useState, useEffect } from 'react';
import AgregarItemModal from './AgregarItemModal';
import { useDispatch, useSelector } from 'react-redux';
import { crearPresupuesto } from '../store/slices/presupuestosSlice';
import api from '../services/api';

const initialMaterial = { nombre: '', cantidad: '', precioUnitario: '' };
const initialProfesional = { nombre: '', horas: '', tarifa: '' };
const initialOtroCosto = { descripcion: '', monto: '' };

const PresupuestoModal = ({ show, onClose }) => {
  const dispatch = useDispatch();
  const loading = useSelector(state => state.presupuestos.loading);
  const error = useSelector(state => state.presupuestos.error);
  const presupuestoCreado = useSelector(state => state.presupuestos.presupuestoCreado);

  const [formData, setFormData] = useState({
    numero: '',
    version: 1,
    estado: 'A enviar',
    descripcion: '',
    observaciones: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaValidez: '',
    fechaCreacion: new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    honorarioDireccionObra: { valorFijo: '', porcentaje: '' },
    materiales: [],
    profesionales: [],
    otrosCostos: []
  });

  // Estado para modales de agregar
  const [modalTipo, setModalTipo] = useState(null);

  // Materiales
  const addMaterial = (mat) => setFormData({
    ...formData,
    materiales: [...formData.materiales, mat]
  });
  const updateMaterial = (idx, field, value) => {
    const materiales = formData.materiales.map((mat, i) => i === idx ? { ...mat, [field]: value } : mat);
    setFormData({ ...formData, materiales });
  };
  const removeMaterial = idx => {
    const materiales = formData.materiales.filter((_, i) => i !== idx);
    setFormData({ ...formData, materiales });
  };

  // Profesionales
  const addProfesional = (pro) => setFormData({
    ...formData,
    profesionales: [...formData.profesionales, pro]
  });
  const updateProfesional = (idx, field, value) => {
    const profesionales = formData.profesionales.map((pro, i) => i === idx ? { ...pro, [field]: value } : pro);
    setFormData({ ...formData, profesionales });
  };
  const removeProfesional = idx => {
    const profesionales = formData.profesionales.filter((_, i) => i !== idx);
    setFormData({ ...formData, profesionales });
  };

  // Otros Costos
  const addOtroCosto = (oc) => setFormData({
    ...formData,
    otrosCostos: [...formData.otrosCostos, oc]
  });
  const updateOtroCosto = (idx, field, value) => {
    const otrosCostos = formData.otrosCostos.map((oc, i) => i === idx ? { ...oc, [field]: value } : oc);
    setFormData({ ...formData, otrosCostos });
  };
  const removeOtroCosto = idx => {
    const otrosCostos = formData.otrosCostos.filter((_, i) => i !== idx);
    setFormData({ ...formData, otrosCostos });
  };


  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const handleSubmit = e => {
    e.preventDefault();
    if (!formData.empresaId || !formData.obraId) {
      alert('Debes seleccionar una empresa y una obra válida.');
      return;
    }
    const { empresaId, obraId, ...dto } = formData;
    dispatch(crearPresupuesto({ dto, empresaId, idObra: obraId }));
    setShowConfirm(true);
  };

  useEffect(() => {
    if (presupuestoCreado) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1800);
    }
  }, [presupuestoCreado, onClose]);


  const [empresas, setEmpresas] = useState([]);
  const [obras, setObras] = useState([]);
  const [empresaInput, setEmpresaInput] = useState('');
  const [obraInput, setObraInput] = useState('');
  const [empresaSugerencias, setEmpresaSugerencias] = useState([]);
  const [obraSugerencias, setObraSugerencias] = useState([]);
  const [busquedaEmpresa, setBusquedaEmpresa] = useState('');
  const [busquedaObra, setBusquedaObra] = useState('');
  // Eliminamos los estados de error

  useEffect(() => {
    if (show) {
      api.get('/api/empresas/simple')
        .then(data => setEmpresas(Array.isArray(data.resultado || data) ? (data.resultado || data) : []));
      api.get('/api/api/obras/todas')
        .then(data => setObras(Array.isArray(data.resultado || data) ? (data.resultado || data) : []));
    }
  }, [show]);

  useEffect(() => {
    if (empresaInput.length > 0) {
      const val = empresaInput.toLowerCase();
      setEmpresaSugerencias(empresas.filter(emp =>
        (emp.nombreEmpresa && emp.nombreEmpresa.toLowerCase().includes(val)) || (emp.id && emp.id.toString().includes(val))
      ).slice(0, 5));
    } else {
      setEmpresaSugerencias([]);
    }
  }, [empresaInput, empresas]);

  useEffect(() => {
    if (obraInput.length > 0) {
      const val = obraInput.toLowerCase();
      setObraSugerencias(obras.filter(obra =>
        (obra.nombre && obra.nombre.toLowerCase().includes(val)) || (obra.id && obra.id.toString().includes(val))
      ).slice(0, 5));
    } else {
      setObraSugerencias([]);
    }
  }, [obraInput, obras]);

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      {showSuccess && (
        <div className="alert alert-success text-center" style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, width: '350px' }}>
          Presupuesto creado correctamente
        </div>
      )}
      <div className="modal-dialog" style={{ maxWidth: '95vw', width: '95vw', height: 'auto', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="modal-content" style={{ minHeight: 'auto', padding: '16px 8px' }}>
          {modalTipo ? (
            <>
              <AgregarItemModal
                show={modalTipo === 'material'}
                tipo="material"
                onClose={() => setModalTipo(null)}
                onSave={addMaterial}
              />
              <AgregarItemModal
                show={modalTipo === 'profesional'}
                tipo="profesional"
                onClose={() => setModalTipo(null)}
                onSave={addProfesional}
              />
              <AgregarItemModal
                show={modalTipo === 'otro'}
                tipo="otro"
                onClose={() => setModalTipo(null)}
                onSave={addOtroCosto}
              />
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ padding: '8px', maxHeight: 'none', overflow: 'visible' }}>
                <div className="row" style={{ marginBottom: '8px' }}>
                  <div className="col-md-3 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Empresa (nombre o ID) *</label>
                    <div style={{ position: 'relative' }}>
                      {empresaSugerencias.length > 0 && (
                        <ul className="list-group position-absolute w-100" style={{ zIndex: 9999, bottom: '100%', marginBottom: '2px' }}>
                          {empresaSugerencias.map(emp => (
                            <li
                              key={emp.id}
                              className="list-group-item list-group-item-action"
                              style={{ cursor: 'pointer', fontSize: '0.95em' }}
                              onClick={e => {
                                e.preventDefault();
                                setEmpresaInput(emp.nombreEmpresa);
                                setFormData(prev => ({
                                  ...prev,
                                  empresaId: emp.id,
                                  empresaNombre: emp.nombreEmpresa
                                }));
                                setTimeout(() => setEmpresaSugerencias([]), 100);
                              }}
                            >
                              {emp.nombreEmpresa} (ID: {emp.id})
                            </li>
                          ))}
                        </ul>
                      )}
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ingrese nombre o ID de empresa"
                        value={empresaInput}
                        onChange={e => {
                          setEmpresaInput(e.target.value);
                          setFormData({ ...formData, empresaId: '' });
                        }}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="col-md-3 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Obra (nombre o ID) *</label>
                    <div style={{ position: 'relative' }}>
                      {obraSugerencias.length > 0 && (
                        <ul className="list-group position-absolute w-100" style={{ zIndex: 9999, bottom: '100%', marginBottom: '2px' }}>
                          {obraSugerencias.map(obra => (
                            <li
                              key={obra.id}
                              className="list-group-item list-group-item-action"
                              style={{ cursor: 'pointer', fontSize: '0.95em' }}
                              onClick={e => {
                                e.preventDefault();
                                setObraInput(obra.nombre ? obra.nombre : '');
                                setFormData(prev => ({
                                  ...prev,
                                  obraId: obra.id,
                                  obraNombre: obra.nombre
                                }));
                                setTimeout(() => setObraSugerencias([]), 100);
                              }}
                            >
                              {(obra.nombre ? obra.nombre : '')} (ID: {obra.id})
                            </li>
                          ))}
                        </ul>
                      )}
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ingrese nombre o ID de obra"
                        value={obraInput}
                        onChange={e => {
                          setObraInput(e.target.value);
                          setFormData({ ...formData, obraId: '' });
                        }}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="col-md-2 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Número</label>
                    <input type="text" className="form-control form-control-sm" value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} />
                  </div>
                  <div className="col-md-1 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Versión</label>
                    <input type="number" className="form-control form-control-sm" value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} />
                  </div>
                  <div className="col-md-2 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Estado</label>
                    <input type="text" className="form-control form-control-sm" value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })} />
                  </div>
                  <div className="col-md-2 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Fecha Emisión</label>
                    <input type="date" className="form-control form-control-sm" value={formData.fechaEmision} onChange={e => setFormData({ ...formData, fechaEmision: e.target.value })} />
                  </div>
                  <div className="col-md-2 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Fecha Validez</label>
                    <input type="date" className="form-control form-control-sm" value={formData.fechaValidez} onChange={e => setFormData({ ...formData, fechaValidez: e.target.value })} />
                  </div>
                  <div className="col-md-1 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Creación</label>
                    <input type="datetime-local" className="form-control form-control-sm" value={formData.fechaCreacion} onChange={e => setFormData({ ...formData, fechaCreacion: e.target.value })} />
                  </div>
                  <div className="col-md-2 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Modificación</label>
                    <input type="datetime-local" className="form-control form-control-sm" value={formData.fechaModificacion} onChange={e => setFormData({ ...formData, fechaModificacion: e.target.value })} />
                  </div>
                </div>
                <div className="row" style={{ marginBottom: '8px' }}>
                  <div className="col-md-6 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Descripción</label>
                    <textarea className="form-control form-control-sm" rows="1" value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} />
                  </div>
                  <div className="col-md-6 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Observaciones</label>
                    <textarea className="form-control form-control-sm" rows="1" value={formData.observaciones} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} />
                  </div>
                </div>
                <div className="row" style={{ marginBottom: '8px' }}>
                  <div className="col-md-6 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Honorario Dirección Obra - Valor Fijo</label>
                    <input type="number" className="form-control form-control-sm" value={formData.honorarioDireccionObra.valorFijo} onChange={e => setFormData({ ...formData, honorarioDireccionObra: { ...formData.honorarioDireccionObra, valorFijo: e.target.value } })} />
                  </div>
                  <div className="col-md-6 mb-1">
                    <label style={{ fontSize: '0.95em' }}>Honorario Dirección Obra - Porcentaje</label>
                    <input type="number" className="form-control form-control-sm" value={formData.honorarioDireccionObra.porcentaje} onChange={e => setFormData({ ...formData, honorarioDireccionObra: { ...formData.honorarioDireccionObra, porcentaje: e.target.value } })} />
                  </div>
                </div>
                <div className="d-flex flex-row justify-content-between align-items-start" style={{gap: '8px', marginBottom: '0'}}>
                  <div style={{flex: 1}}>
                    <label style={{ fontSize: '0.95em' }}>Materiales</label>
                    <ul className="list-group mb-1">
                      {formData.materiales.map((mat, idx) => (
                        <li className="list-group-item py-1 px-2 d-flex justify-content-between align-items-center" key={idx} style={{ fontSize: '0.95em' }}>
                          {mat.nombre} ({mat.cantidad} {mat.unidadMedida})
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMaterial(idx)}><i className="fas fa-trash"></i></button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-success btn-sm" onClick={() => setModalTipo('material')}><i className="fas fa-plus"></i> Agregar Material</button>
                  </div>
                  <div style={{flex: 1}}>
                    <label style={{ fontSize: '0.95em' }}>Profesionales</label>
                    <ul className="list-group mb-1">
                      {formData.profesionales.map((pro, idx) => (
                        <li className="list-group-item py-1 px-2 d-flex justify-content-between align-items-center" key={idx} style={{ fontSize: '0.95em' }}>
                          {pro.tipo} ({pro.horas}h, {pro.dias}d, {pro.semanas}s, {pro.meses}m)
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeProfesional(idx)}><i className="fas fa-trash"></i></button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-success btn-sm" onClick={() => setModalTipo('profesional')}><i className="fas fa-plus"></i> Agregar Profesional</button>
                  </div>
                  <div style={{flex: 1}}>
                    <label style={{ fontSize: '0.95em' }}>Otros Costos</label>
                    <ul className="list-group mb-1">
                      {formData.otrosCostos.map((oc, idx) => (
                        <li className="list-group-item py-1 px-2 d-flex justify-content-between align-items-center" key={idx} style={{ fontSize: '0.95em' }}>
                          {oc.descripcion} (${oc.monto})
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeOtroCosto(idx)}><i className="fas fa-trash"></i></button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-success btn-sm" onClick={() => setModalTipo('otro')}><i className="fas fa-plus"></i> Agregar Otro Costo</button>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Presupuesto'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default PresupuestoModal;

