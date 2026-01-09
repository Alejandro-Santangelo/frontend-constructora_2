import React, { useState } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Button, Form, Alert } from 'react-bootstrap';
import { useSelector } from 'react-redux';

const EliminarPresupuestoPorEmpresaObraVersionModal = ({ show, onClose, onEliminar, initialValues }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const empresas = useSelector(state => state.empresas.empresas);
  const obras = useSelector(state => state.obras.obras);
  const { empresaSeleccionada } = useEmpresa();
  const [obraIdSelect, setObraIdSelect] = useState(initialValues?.idObra ? String(initialValues.idObra) : '');
  const [obraIdInput, setObraIdInput] = useState('');
  const [versionSelect, setVersionSelect] = useState(initialValues?.version ? String(initialValues.version) : '');
  const [versionInput, setVersionInput] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getEmpresaId = () => empresaSeleccionada ? empresaSeleccionada.id : '';
  const getObraId = () => obraIdInput || obraIdSelect;
  const getVersion = () => versionInput || versionSelect;

  const handleEliminar = async () => {
    setError(null);
    setLoading(true);
    const empresaId = getEmpresaId();
    const obraId = getObraId();
    const version = getVersion();
    if (!empresaId || !obraId || !version) {
      setError('Todos los campos son obligatorios.');
      setLoading(false);
      return;
    }
  setLoading(false);
  setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setError(null);
    setLoading(true);
    const empresaId = getEmpresaId();
    const obraId = getObraId();
    const version = getVersion();
    try {
      const params = new URLSearchParams({ empresaId, obraId, version });
      const res = await fetch(`/api/presupuestos/eliminar-por-empresa-obra-version?${params.toString()}`, {
        method: 'DELETE',
        headers: { 'Accept': '*/*' }
      });
      if (!res.ok) throw new Error(await res.text());
      if (onEliminar) onEliminar();
      setLoading(false);
      setShowConfirm(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al eliminar presupuesto');
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (show) {
    console.log('Renderizando modal de eliminación con valores:', initialValues);
    console.log('Empresas:', empresas);
    console.log('Obras:', obras);
  }
  if (!show) return null;
  return (
    <div style={{position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'#fff', padding:32, borderRadius:12, minWidth:350, boxShadow:'0 0 20px #000'}}>
        <div style={{color:'red', fontWeight:'bold', fontSize:18, marginBottom:12}}>MODAL ELIMINAR PRESUPUESTO ABIERTO</div>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Empresa seleccionada</Form.Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 500, fontSize: 15 }}>
                {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || empresaSeleccionada?.razonSocial || empresaSeleccionada?.cuit || empresaSeleccionada?.id || 'Sin empresa'}
              </span>
              <input
                type="number"
                value={empresaSeleccionada ? empresaSeleccionada.id : ''}
                disabled
                readOnly
                style={{ minWidth: 0, width: 80, fontSize: 13, padding: '2px 6px', textAlign: 'center', background: '#e9ecef' }}
                title="ID de empresa seleccionada"
              />
            </div>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Obra</Form.Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={obraIdSelect} onChange={e => setObraIdSelect(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="">Seleccione...</option>
                {obras && obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre || `Obra #${o.id}`}</option>
                ))}
              </select>
              <input type="number" value={obraIdInput} onChange={e => setObraIdInput(e.target.value)} placeholder="ID manual" style={{ maxWidth: 120 }} />
            </div>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Versión</Form.Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={versionSelect} onChange={e => setVersionSelect(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="">Seleccione...</option>
                {[1,2,3,4,5,6,7,8,9,10].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <input type="number" value={versionInput} onChange={e => setVersionInput(e.target.value)} placeholder="Versión manual" style={{ maxWidth: 120 }} />
            </div>
          </Form.Group>
          {error && <div style={{color:'red', marginBottom:8}}>{error}</div>}
        </Form>
        <div style={{display:'flex', justifyContent:'flex-end', gap:12, marginTop:24}}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            onClick={handleEliminar}
            disabled={loading || !getEmpresaId() || !getObraId() || !getVersion()}
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
        {showConfirm && (
          <div style={{position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.5)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{background:'#fff', padding:24, borderRadius:10, minWidth:320, boxShadow:'0 0 12px #000'}}>
              <div style={{fontWeight:'bold', fontSize:16, marginBottom:12}}>¿Seguro que deseas eliminar este presupuesto?</div>
              <div style={{marginBottom:16}}>
                <div><b>Empresa:</b> {empresas?.find(e => String(e.id) === String(getEmpresaId()))?.nombreEmpresa || empresas?.find(e => String(e.id) === String(getEmpresaId()))?.nombre || getEmpresaId()}</div>
                <div><b>Obra:</b> {obras?.find(o => String(o.id) === String(getObraId()))?.nombre || getObraId()}</div>
                <div><b>Versión:</b> {getVersion()}</div>
              </div>
              {error && <div style={{color:'red', marginBottom:8}}>{error}</div>}
              <div style={{display:'flex', justifyContent:'flex-end', gap:12}}>
                <Button variant="secondary" onClick={() => { setShowConfirm(false); setError(null); setLoading(false); }}>Cancelar</Button>
                <Button variant="danger" onClick={handleConfirmDelete} disabled={loading ? true : false}>
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EliminarPresupuestoPorEmpresaObraVersionModal;
