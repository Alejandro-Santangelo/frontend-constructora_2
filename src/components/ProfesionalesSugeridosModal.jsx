// ...eliminado código fuera del componente, todo hook debe ir dentro de la función...
import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext.jsx';
import { Modal, Button, Form, Table, Spinner, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { selectEmpresas } from '../store/slices/empresasSlice';

const CRITERIOS = [
  { value: 'MENOR_CARGA', label: 'Menor carga' },
  { value: 'MENOR_COSTO', label: 'Menor costo' },
  { value: 'MAYOR_EXPERIENCIA', label: 'Mayor experiencia' },
];

function ProfesionalesSugeridosModal({ show, onClose }) {
  const dispatch = useDispatch();
  const empresas = useSelector(selectEmpresas);
  const presupuestos = useSelector(state => state.presupuestos.lista);
  const obras = useSelector(state => state.obras.obras);
  const profesionales = useSelector(state => (state.profesionales && state.profesionales.lista) ? state.profesionales.lista : []);
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestoId, setPresupuestoId] = useState('');
  const [presupuestoIdManual, setPresupuestoIdManual] = useState('');
  const [obraId, setObraId] = useState('');
  const [obraIdManual, setObraIdManual] = useState('');
  const [version, setVersion] = useState('');
  const [criterio, setCriterio] = useState('MENOR_CARGA');
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  // Cargar empresas, presupuestos y obras si no hay datos
  useEffect(() => {
    if (!empresas || empresas.length === 0) {
      dispatch({ type: 'empresas/fetchAllEmpresas' });
    }
    if (!presupuestos || presupuestos.length === 0) {
      dispatch({ type: 'presupuestos/fetchAllPresupuestos' });
    }
    if (!obras || obras.length === 0) {
      dispatch({ type: 'obras/fetchAllObras' });
    }
  }, [dispatch, empresas, presupuestos, obras]);

  const handleBuscar = async (e) => {
    e.preventDefault();
    setFormError(null);
    setError(null);
    setResultados(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const idPresupuesto = presupuestoIdManual.trim() !== '' ? presupuestoIdManual : presupuestoId;
      const idObra = obraIdManual.trim() !== '' ? obraIdManual : obraId;
      const idEmpresa = empresaIdManual.trim() !== '' ? empresaIdManual : empresaId;
      if (!idEmpresa) {
        setFormError('Debe seleccionar o ingresar un ID de empresa.');
        setLoading(false);
        return;
      }
      if (!idPresupuesto && !idObra) {
        setFormError('Debe seleccionar o ingresar un ID de presupuesto o de obra.');
        setLoading(false);
        return;
      }
      if (idPresupuesto) params.append('presupuestoId', idPresupuesto);
      if (idObra) params.append('obraId', idObra);
      params.append('empresaId', idEmpresa);
      if (version) params.append('version', version);
      if (criterio) params.append('criterio', criterio);
      const res = await fetch(`/api/presupuestos/profesionales-sugeridos?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setResultados(await res.json());
    } catch (err) {
      setError(err.message || 'Error al buscar sugerencias');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Sugerencias de Profesionales</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleBuscar} className="mb-3">
          <div className="row">
            <div className="col-md-3 mb-2">
              <Form.Label>Empresa seleccionada</Form.Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontWeight: 500, fontSize: 15 }}>
                  {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || empresaSeleccionada?.razonSocial || empresaSeleccionada?.cuit || empresaSeleccionada?.id || 'Sin empresa'}
                </span>
                <Form.Control
                  type="number"
                  value={empresaSeleccionada ? empresaSeleccionada.id : ''}
                  disabled
                  readOnly
                  style={{ minWidth: 0, width: 80, fontSize: 13, padding: '2px 6px', textAlign: 'center', background: '#e9ecef' }}
                  title="ID de empresa seleccionada"
                />
              </div>
            </div>
            <div className="col-md-3 mb-2">
              <Form.Label>Presupuesto</Form.Label>
              <div className="d-flex gap-2">
                <Form.Select
                  value={presupuestoId}
                  onChange={e => setPresupuestoId(e.target.value)}
                  style={{ minWidth: 0, flex: 1 }}
                  aria-label="Seleccionar presupuesto"
                >
                  <option value="">Seleccione un presupuesto...</option>
                  {presupuestos && presupuestos.length > 0 ? presupuestos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre || `Presupuesto #${p.id}`}</option>
                  )) : <option disabled value="">No hay presupuestos</option>}
                </Form.Select>
                <Form.Control
                  type="number"
                  min={1}
                  placeholder="ID manual"
                  value={presupuestoIdManual}
                  onChange={e => setPresupuestoIdManual(e.target.value)}
                  style={{ minWidth: 0, width: '110px' }}
                />
              </div>
              <Form.Text muted>
                Seleccione un presupuesto o ingrese el ID manualmente (el input manual tiene prioridad).
              </Form.Text>
            </div>
            <div className="col-md-3 mb-2">
              <Form.Label>Obra</Form.Label>
              <div className="d-flex gap-2">
                <Form.Select
                  value={obraId}
                  onChange={e => setObraId(e.target.value)}
                  style={{ minWidth: 0, flex: 1 }}
                  aria-label="Seleccionar obra"
                >
                  <option value="">Seleccione una obra...</option>
                  {obras && obras.length > 0 ? obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nombre || `Obra #${o.id}`}</option>
                  )) : <option disabled value="">No hay obras</option>}
                </Form.Select>
                <Form.Control
                  type="number"
                  min={1}
                  placeholder="ID manual"
                  value={obraIdManual}
                  onChange={e => setObraIdManual(e.target.value)}
                  style={{ minWidth: 0, width: '110px' }}
                />
              </div>
              <Form.Text muted>
                Seleccione una obra o ingrese el ID manualmente (el input manual tiene prioridad).
              </Form.Text>
            </div>
            <div className="col-md-2 mb-2">
              <Form.Label>Versión (opcional)</Form.Label>
              <Form.Control
                type="number"
                value={version}
                onChange={e => setVersion(e.target.value)}
                min={1}
                placeholder="Última"
              />
            </div>
            <div className="col-md-2 mb-2">
              <Form.Label>Criterio</Form.Label>
              <Form.Select
                value={criterio}
                onChange={e => setCriterio(e.target.value)}
                aria-label="Seleccionar criterio"
              >
                {CRITERIOS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-2 mb-2 d-flex align-items-end">
              <Button type="submit" variant="primary" block disabled={loading}>
                {loading ? <Spinner size="sm" animation="border" /> : 'Buscar'}
              </Button>
            </div>
          </div>
        </Form>
            {formError && <Alert variant="warning">{formError}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}
            {resultados && Array.isArray(resultados) && resultados.length > 0 ? (
                resultados.map((sug, idx) => (
                    <div key={sug.presupuestoProfesionalId || idx} className="mb-4">
                        <h5 className="mb-2">{sug.tipoProfesional} (Requeridos: {sug.cantidadRequerida})</h5>
                        <Table bordered size="sm" responsive>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Especialidad</th>
                                    <th>Valor Hora</th>
                                    <th>Obras Activas</th>
                                    <th>Disponible</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sug.profesionalesDisponibles.map(prof => (
                                    <tr key={prof.id}>
                                        <td>{prof.nombre}</td>
                                        <td>{prof.especialidad}</td>
                                        <td>{prof.valorHoraDefault}</td>
                                        <td>{prof.obrasActivas}</td>
                                        <td>{prof.disponible ? 'Sí' : 'No'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                ))
            ) : resultados && Array.isArray(resultados) && resultados.length === 0 ? (
                <Alert variant="info">No hay sugerencias para los filtros seleccionados.</Alert>
            ) : null}
            {/* Si no hay resultados, mostrar todos los profesionales de la tabla */}
            {!resultados && profesionales.length > 0 && (
                <>
                    <h5 className="mt-4">Todos los profesionales</h5>
                    <Table bordered size="sm" responsive>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Especialidad</th>
                                <th>Valor Hora</th>
                                <th>Disponible</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profesionales.map(prof => (
                                <tr key={prof.id}>
                                    <td>{prof.nombre}</td>
                                    <td>{prof.tipoProfesional}</td>
                                    <td>{prof.especialidad}</td>
                                    <td>{prof.valorHoraDefault}</td>
                                    <td>{prof.disponible ? 'Sí' : 'No'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </>
            )}
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </Modal.Footer>
    </Modal>
 );
}

export default ProfesionalesSugeridosModal;

