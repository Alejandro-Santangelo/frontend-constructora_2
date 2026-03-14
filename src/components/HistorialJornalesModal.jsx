import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner, Alert, Badge, Form, ButtonGroup } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import * as jornalesService from '../services/jornalesDiariosService';

/**
 * Modal para ver el historial de jornales diarios de una obra
 * Muestra resumen por profesional y detalle de jornales
 */
const HistorialJornalesModal = ({ show, onHide, obra }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados
  const [vista, setVista] = useState('resumen'); // 'resumen' | 'detalle'
  const [resumenProfesionales, setResumenProfesionales] = useState([]);
  const [jornalesDetalle, setJornalesDetalle] = useState([]);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (show && obra && empresaSeleccionada) {
      cargarDatos();
    }
  }, [show, obra, empresaSeleccionada, vista]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);

    try {
      if (vista === 'resumen') {
        // Cargar todos los jornales de la obra y calcular resumen
        const response = await jornalesService.listarJornalesPorObra(obra.id, empresaSeleccionada.id);
        const jornales = Array.isArray(response) ? response : (response?.data || []);

        // Calcular resumen por profesional
        const resumenMap = {};
        jornales.forEach(jornal => {
          const key = jornal.profesionalId;
          if (!resumenMap[key]) {
            resumenMap[key] = {
              profesionalId: jornal.profesionalId,
              nombreProfesional: jornal.profesionalNombre,
              tipoProfesional: jornal.tipoProfesional,
              totalHorasTrabajadas: 0,
              totalMontoCobrado: 0,
              cantidadJornales: 0,
              sumaTarifas: 0
            };
          }
          resumenMap[key].totalHorasTrabajadas += jornal.horasTrabajadasDecimal || 0;
          resumenMap[key].totalMontoCobrado += jornal.montoCobrado || 0;
          resumenMap[key].sumaTarifas += jornal.tarifaDiaria || 0;
          resumenMap[key].cantidadJornales += 1;
        });

        // Calcular tarifa promedio para cada profesional
        Object.values(resumenMap).forEach(resumen => {
          resumen.tarifaPromedio = resumen.cantidadJornales > 0 
            ? resumen.sumaTarifas / resumen.cantidadJornales 
            : 0;
          delete resumen.sumaTarifas; // Ya no necesitamos este campo temporal
        });

        const resumen = Object.values(resumenMap);
        setResumenProfesionales(resumen);
        console.log(`✅ Resumen de ${resumen.length} profesionales calculado desde ${jornales.length} jornales`);
      } else {
        // Cargar detalle de jornales
        const response = await jornalesService.listarJornalesPorObra(obra.id, empresaSeleccionada.id);
        const jornales = Array.isArray(response) ? response : (response?.data || []);

        // Aplicar filtros de fecha si existen
        let jornalesFiltrados = jornales;
        if (filtroFechaDesde) {
          jornalesFiltrados = jornalesFiltrados.filter(j => j.fecha >= filtroFechaDesde);
        }
        if (filtroFechaHasta) {
          jornalesFiltrados = jornalesFiltrados.filter(j => j.fecha <= filtroFechaHasta);
        }

        // Ordenar por fecha descendente (más reciente primero)
        jornalesFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        setJornalesDetalle(jornalesFiltrados);
        console.log(`✅ ${jornalesFiltrados.length} jornales cargados`);
      }
    } catch (err) {
      console.error('❌ Error al cargar datos:', err);
      setError('No se pudieron cargar los datos: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAplicarFiltros = () => {
    cargarDatos();
  };

  const handleLimpiarFiltros = () => {
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr + 'T00:00:00');
    return fecha.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleClose = () => {
    setVista('resumen');
    setResumenProfesionales([]);
    setJornalesDetalle([]);
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setError(null);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-history me-2"></i>
          Historial de Asignaciones Diarias - {obra?.nombre || 'Obra'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Selector de Vista */}
        <div className="mb-4 d-flex justify-content-between align-items-center">
          <ButtonGroup>
            <Button
              variant={vista === 'resumen' ? 'primary' : 'outline-primary'}
              onClick={() => setVista('resumen')}
            >
              <i className="fas fa-chart-bar me-2"></i>
              Resumen por Profesional
            </Button>
            <Button
              variant={vista === 'detalle' ? 'primary' : 'outline-primary'}
              onClick={() => setVista('detalle')}
            >
              <i className="fas fa-list me-2"></i>
              Detalle de Jornales
            </Button>
          </ButtonGroup>

          {vista === 'detalle' && (
            <div className="d-flex gap-2">
              <Form.Control
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                placeholder="Desde"
                size="sm"
                style={{ width: '150px' }}
              />
              <Form.Control
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                placeholder="Hasta"
                size="sm"
                style={{ width: '150px' }}
              />
              <Button size="sm" variant="info" onClick={handleAplicarFiltros}>
                <i className="fas fa-filter"></i>
              </Button>
              {(filtroFechaDesde || filtroFechaHasta) && (
                <Button size="sm" variant="secondary" onClick={handleLimpiarFiltros}>
                  <i className="fas fa-times"></i>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Cargando datos...</p>
          </div>
        )}

        {/* Vista Resumen */}
        {!loading && vista === 'resumen' && (
          <>
            {resumenProfesionales.length === 0 ? (
              <Alert variant="info">
                <i className="fas fa-info-circle me-2"></i>
                No hay jornales registrados para esta obra aún.
              </Alert>
            ) : (
              <Table bordered hover responsive>
                <thead className="table-light">
                  <tr>
                    <th>Profesional</th>
                    <th>Tipo</th>
                    <th className="text-center">Jornales</th>
                    <th className="text-center">Total Días</th>
                    <th className="text-end">Tarifa Promedio</th>
                    <th className="text-end">Total Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenProfesionales.map((resumen, idx) => (
                    <tr key={idx}>
                      <td className="fw-bold">{resumen.nombreProfesional || 'N/A'}</td>
                      <td>
                        <small className="text-muted">
                          {resumen.tipoProfesional || 'N/A'}
                        </small>
                      </td>
                      <td className="text-center">
                        <Badge bg="success">{resumen.cantidadJornales || 0}</Badge>
                      </td>
                      <td className="text-center">
                        <Badge bg="primary" style={{ fontSize: '0.9rem' }}>
                          {resumen.totalHorasTrabajadas?.toFixed(2) || '0.00'} días
                        </Badge>
                      </td>
                      <td className="text-end">
                        ${resumen.tarifaPromedio?.toLocaleString('es-AR') || '0'}
                      </td>
                      <td className="text-end fw-bold text-primary">
                        ${resumen.totalMontoCobrado?.toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <td colSpan="5" className="text-end fw-bold">
                      TOTAL OBRA:
                    </td>
                    <td className="text-end fw-bold text-success">
                      ${resumenProfesionales
                        .reduce((sum, r) => sum + (r.totalMontoCobrado || 0), 0)
                        .toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            )}
          </>
        )}

        {/* Vista Detalle */}
        {!loading && vista === 'detalle' && (
          <>
            {jornalesDetalle.length === 0 ? (
              <Alert variant="info">
                <i className="fas fa-info-circle me-2"></i>
                {filtroFechaDesde || filtroFechaHasta
                  ? 'No hay jornales en el rango de fechas seleccionado.'
                  : 'No hay jornales registrados para esta obra aún.'}
              </Alert>
            ) : (
              <>
                <div className="mb-2 text-muted">
                  <small>
                    <i className="fas fa-calendar me-2"></i>
                    Mostrando {jornalesDetalle.length} jornales
                    {filtroFechaDesde && ` desde ${formatearFecha(filtroFechaDesde)}`}
                    {filtroFechaHasta && ` hasta ${formatearFecha(filtroFechaHasta)}`}
                  </small>
                </div>
                <Table bordered hover responsive>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '10%' }}>Fecha</th>
                      <th style={{ width: '22%' }}>Profesional</th>
                      <th style={{ width: '13%' }}>Tipo</th>
                      <th style={{ width: '15%' }}>Rubro</th>
                      <th style={{ width: '8%' }} className="text-center">Días</th>
                      <th style={{ width: '10%' }} className="text-end">Tarifa</th>
                      <th style={{ width: '10%' }} className="text-end">Monto</th>
                      <th style={{ width: '12%' }}>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jornalesDetalle.map((jornal) => (
                      <tr key={jornal.id}>
                        <td>
                          <Badge bg="light" text="dark" className="border">
                            📅 {formatearFecha(jornal.fecha)}
                          </Badge>
                        </td>
                        <td className="fw-bold">{jornal.profesionalNombre || 'N/A'}</td>
                        <td>
                          <small className="text-muted">{jornal.tipoProfesional || 'N/A'}</small>
                        </td>
                        <td>
                          {jornal.rubroNombre ? (
                            <Badge bg="secondary" className="text-wrap" style={{ fontSize: '0.75rem' }}>
                              {jornal.rubroNombre}
                            </Badge>
                          ) : (
                            <small className="text-muted">Sin rubro</small>
                          )}
                        </td>
                        <td className="text-center">
                          <Badge bg="primary">{jornal.horasTrabajadasDecimal}d</Badge>
                        </td>
                        <td className="text-end">
                          ${jornal.tarifaDiaria?.toLocaleString('es-AR') || '0'}
                        </td>
                        <td className="text-end fw-bold">
                          ${jornal.montoCobrado?.toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) || '0.00'}
                        </td>
                        <td>
                          <small className="text-muted">
                            {jornal.observaciones || '-'}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan="6" className="text-end fw-bold">
                        TOTAL:
                      </td>
                      <td className="text-end fw-bold text-success">
                        ${jornalesDetalle
                          .reduce((sum, j) => sum + (j.montoCobrado || 0), 0)
                          .toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </Table>
              </>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          <i className="fas fa-times me-2"></i>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HistorialJornalesModal;
