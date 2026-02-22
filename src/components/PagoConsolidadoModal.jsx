import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import { useEmpresa } from '../EmpresaContext';
import { getTipoProfesionalBadgeClass, ordenarPorRubro } from '../utils/badgeColors';

const PagoConsolidadoModal = ({ show, onHide, onSuccess }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [profesionales, setProfesionales] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [otrosCostos, setOtrosCostos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [tipoGasto, setTipoGasto] = useState('profesionales');
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarDatos();
    }
  }, [show, empresaSeleccionada]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError('');

      const [respAprobado, respEnEjecucion] = await Promise.all([
        apiService.presupuestosNoCliente.busquedaAvanzada({ estado: 'APROBADO' }, empresaSeleccionada.id),
        apiService.presupuestosNoCliente.busquedaAvanzada({ estado: 'EN_EJECUCION' }, empresaSeleccionada.id)
      ]);

      const extractData = (resp) => Array.isArray(resp) ? resp : (resp?.datos || resp?.content || resp?.data || []);
      const presupuestos = [...extractData(respAprobado), ...extractData(respEnEjecucion)];

      // Cargar datos completos de cada presupuesto
      const presupuestosCompletos = await Promise.all(
        presupuestos.map(p => apiService.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id))
      );

      const todosProfesionales = [];
      const todosMateriales = [];
      const todosOtrosCostos = [];

      presupuestosCompletos.forEach(presupuesto => {
        const obraInfo = `${presupuesto.nombreObra || 'Presupuesto #' + presupuesto.numeroPresupuesto}`;

        // Profesionales
        if (presupuesto.profesionales?.length > 0) {
          presupuesto.profesionales.forEach(prof => {
            todosProfesionales.push({
              ...prof,
              obra: obraInfo,
              presupuestoId: presupuesto.id,
              tipo: 'profesional'
            });
          });
        }

        // Profesionales de calculadora
        if (presupuesto.itemsCalculadora?.length > 0) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.profesionales?.length > 0) {
              item.profesionales.forEach(prof => {
                todosProfesionales.push({
                  ...prof,
                  obra: obraInfo,
                  presupuestoId: presupuesto.id,
                  tipo: 'profesional'
                });
              });
            }
          });
        }

        // Materiales
        if (presupuesto.materiales?.length > 0) {
          presupuesto.materiales.forEach(mat => {
            todosMateriales.push({
              ...mat,
              obra: obraInfo,
              presupuestoId: presupuesto.id,
              importe: (mat.cantidad || 0) * (mat.precioUnitario || 0),
              tipo: 'material'
            });
          });
        }

        // Materiales de calculadora
        if (presupuesto.itemsCalculadora?.length > 0) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.materialesLista?.length > 0) {
              item.materialesLista.forEach(mat => {
                todosMateriales.push({
                  ...mat,
                  obra: obraInfo,
                  presupuestoId: presupuesto.id,
                  importe: (mat.cantidad || 0) * (mat.precioUnitario || 0),
                  tipo: 'material'
                });
              });
            }
          });
        }

        // Otros costos (filtrar presupuestos globales que no son gastos reales)
        if (presupuesto.otrosCostos?.length > 0) {
          presupuesto.otrosCostos.forEach(costo => {
            // ✅ Excluir "Presupuesto Global Gastos Grales." - son fondos asignados, no gastos a pagar
            if (costo.descripcion && costo.descripcion.includes('Presupuesto Global Gastos Grales.')) {
              return; // No agregar a la lista de pagos
            }

            todosOtrosCostos.push({
              ...costo,
              obra: obraInfo,
              presupuestoId: presupuesto.id,
              tipo: 'otro'
            });
          });
        }
      });

      setProfesionales(todosProfesionales);
      setMateriales(todosMateriales);
      setOtrosCostos(todosOtrosCostos);

    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar datos de las obras');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSeleccion = (item) => {
    const id = `${item.presupuestoId}_${item.tipo}_${item.nombreProfesional || item.tipoMaterial || item.descripcion}`;
    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter(s => s !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  };

  const handleSeleccionarTodos = () => {
    const items = tipoGasto === 'profesionales' ? profesionales : tipoGasto === 'materiales' ? materiales : otrosCostos;
    const ids = items.map(item => `${item.presupuestoId}_${item.tipo}_${item.nombreProfesional || item.tipoMaterial || item.descripcion}`);
    setSeleccionados(ids);
  };

  const handleDeseleccionarTodos = () => {
    setSeleccionados([]);
  };

  const calcularTotalSeleccionado = () => {
    const items = tipoGasto === 'profesionales' ? profesionales : tipoGasto === 'materiales' ? materiales : otrosCostos;
    return items
      .filter(item => seleccionados.includes(`${item.presupuestoId}_${item.tipo}_${item.nombreProfesional || item.tipoMaterial || item.descripcion}`))
      .reduce((sum, item) => sum + (item.importeCalculado || item.importe || 0), 0);
  };

  const handlePagarSeleccionados = () => {
    const total = calcularTotalSeleccionado();
    if (total === 0) {
      alert('No hay items seleccionados');
      return;
    }

    if (window.confirm(`¿Confirmar pago de $${total.toLocaleString('es-AR')} a ${seleccionados.length} items seleccionados?`)) {
      // Aquí iría la lógica de pago
      onSuccess?.({ mensaje: `Pago consolidado de $${total.toLocaleString('es-AR')} registrado exitosamente` });
      onHide();
    }
  };

  if (!show) return null;

  const itemsActuales = tipoGasto === 'profesionales' ? profesionales : tipoGasto === 'materiales' ? materiales : otrosCostos;
  const totalGeneral = itemsActuales.reduce((sum, item) => sum + (item.importeCalculado || item.importe || 0), 0);

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="bi bi-calculator me-2"></i>
              Pago Consolidado - Todas las Obras Activas
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status"></div>
                <p className="mt-3">Cargando datos...</p>
              </div>
            ) : (
              <>
                {/* Selector de tipo */}
                <div className="mb-3">
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn ${tipoGasto === 'profesionales' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => { setTipoGasto('profesionales'); setSeleccionados([]); }}
                    >
                      👷 Profesionales ({profesionales.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${tipoGasto === 'materiales' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => { setTipoGasto('materiales'); setSeleccionados([]); }}
                    >
                      🧱 Materiales ({materiales.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${tipoGasto === 'otros' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => { setTipoGasto('otros'); setSeleccionados([]); }}
                    >
                      📋 Otros Costos ({otrosCostos.length})
                    </button>
                  </div>
                </div>

                {/* Botones de selección */}
                <div className="mb-3 d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={handleSeleccionarTodos}>
                    ✅ Seleccionar Todos
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={handleDeseleccionarTodos}>
                    ❌ Deseleccionar Todos
                  </button>
                  <div className="ms-auto">
                    <strong>Seleccionados:</strong> {seleccionados.length} |
                    <strong className="ms-2">Total:</strong> ${calcularTotalSeleccionado().toLocaleString('es-AR')}
                  </div>
                </div>

                {/* Lista de items */}
                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <table className="table table-hover table-sm">
                    <thead className="table-dark sticky-top">
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={seleccionados.length === itemsActuales.length && itemsActuales.length > 0}
                            onChange={e => e.target.checked ? handleSeleccionarTodos() : handleDeseleccionarTodos()}
                          />
                        </th>
                        <th>Obra</th>
                        <th>{tipoGasto === 'profesionales' ? 'Nombre' : tipoGasto === 'materiales' ? 'Material' : 'Descripción'}</th>
                        {tipoGasto === 'profesionales' && <th>Tipo</th>}
                        {tipoGasto === 'materiales' && <th>Cantidad</th>}
                        <th className="text-end">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tipoGasto === 'profesionales' ? ordenarPorRubro(itemsActuales) : itemsActuales).map((item, idx) => {
                        const id = `${item.presupuestoId}_${item.tipo}_${item.nombreProfesional || item.tipoMaterial || item.descripcion}`;
                        const isSelected = seleccionados.includes(id);

                        return (
                          <tr
                            key={idx}
                            className={isSelected ? 'table-primary' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleToggleSeleccion(item)}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                              />
                            </td>
                            <td><small className="text-muted">{item.obra}</small></td>
                            <td className="fw-bold">
                              {item.nombreProfesional || item.tipoMaterial || item.descripcion}
                            </td>
                            {tipoGasto === 'profesionales' && (
                              <td><span className={`badge ${getTipoProfesionalBadgeClass(item.tipoProfesional)}`}>{item.tipoProfesional}</span></td>
                            )}
                            {tipoGasto === 'materiales' && (
                              <td>{item.cantidad}</td>
                            )}
                            <td className="text-end">
                              <strong>${(item.importeCalculado || item.importe || 0).toLocaleString('es-AR')}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="table-secondary">
                      <tr>
                        <td colSpan={tipoGasto === 'profesionales' ? 4 : tipoGasto === 'materiales' ? 4 : 3} className="text-end fw-bold">
                          TOTAL GENERAL:
                        </td>
                        <td className="text-end fw-bold">
                          ${totalGeneral.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
            <button
              className="btn btn-success"
              onClick={handlePagarSeleccionados}
              disabled={seleccionados.length === 0}
            >
              💵 Pagar Seleccionados (${calcularTotalSeleccionado().toLocaleString('es-AR')})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagoConsolidadoModal;
