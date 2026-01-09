import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import api from '../services/api';
import axios from 'axios';

const EstadisticasObraModal = ({ obra, empresaId, onClose, showNotification }) => {
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState({
    presupuesto: null,
    profesionales: [],
    materiales: [],
    otrosCostos: [],
    trabajosExtra: [],
    etapasDiarias: [],
    cobros: [],
    pagos: [],
    resumen: {
      totalPresupuestado: 0,
      totalGastado: 0,
      totalCobrado: 0,
      totalPagado: 0,
      rentabilidad: 0,
      porcentajeAvance: 0
    }
  });

  useEffect(() => {
    if (obra && empresaId) {
      cargarEstadisticas();
    }
  }, [obra, empresaId]);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando estadísticas para obra:', obra.id);

      // Cargar todos los datos en paralelo
      const [
        presupuestoData,
        profesionalesData,
        materialesData,
        otrosCostosData,
        trabajosExtraData,
        etapasDiariasData
      ] = await Promise.all([
        // Presupuesto - Buscar la versión más alta con estado APROBADO o EN_EJECUCION
        api.presupuestosNoCliente.getAll(empresaId).then(todos => {
          // Filtrar presupuestos de esta obra con estado APROBADO o EN_EJECUCION
          const presupuestosObra = (todos || []).filter(p => 
            (p.obraId === obra.id || p.idObra === obra.id) && 
            (p.estado === 'APROBADO' || p.estado === 'EN_EJECUCION')
          );
          
          if (presupuestosObra.length > 0) {
            // Encontrar el presupuesto con el número de versión más alto
            const presupuestoUltimaVersion = presupuestosObra.reduce((max, p) => {
              const versionActual = p.numeroVersion || 0;
              const versionMax = max.numeroVersion || 0;
              return versionActual > versionMax ? p : max;
            }, presupuestosObra[0]);
            
            console.log('📊 Presupuesto última versión encontrado:', presupuestoUltimaVersion);
            console.log('📈 Versión:', presupuestoUltimaVersion.numeroVersion, '| Estado:', presupuestoUltimaVersion.estado);
            console.log('💰 totalFinal:', presupuestoUltimaVersion.totalFinal);
            console.log('💰 totalPresupuesto:', presupuestoUltimaVersion.totalPresupuesto);
            
            return presupuestoUltimaVersion;
          } else {
            console.warn('⚠️ No se encontró presupuesto APROBADO o EN_EJECUCION para la obra');
            return null;
          }
        }).catch(error => {
          console.warn('⚠️ Error cargando presupuesto:', error);
          return null;
        }),

        // Profesionales asignados - Probar múltiples endpoints
        axios.get(`/api/profesionales/asignaciones/${obra.id}`, {
          headers: { 
            empresaId: empresaId,
            'X-Tenant-ID': empresaId 
          },
          params: { empresaId }
        }).then(response => {
          const data = response.data?.data || response.data || [];
          console.log('👷 Profesionales asignados:', data);
          return Array.isArray(data) ? data : [];
        }).catch(async (error) => {
          console.warn('⚠️ Error con /asignaciones, intentando endpoint alternativo:', error);
          // Intentar endpoint alternativo
          try {
            const altResponse = await axios.get(`/api/obras/${obra.id}/profesionales`, {
              headers: { empresaId, 'X-Tenant-ID': empresaId }
            });
            const altData = altResponse.data?.data || altResponse.data || [];
            console.log('👷 Profesionales (alternativo):', altData);
            return Array.isArray(altData) ? altData : [];
          } catch (altError) {
            console.warn('⚠️ Error en endpoint alternativo también');
            return [];
          }
        }),

        // Materiales
        axios.get(`/api/obras/${obra.id}/materiales`, {
          headers: { 
            empresaId: empresaId,
            'X-Tenant-ID': empresaId 
          }
        }).then(response => {
          const data = response.data?.data || response.data || [];
          console.log('📦 Materiales asignados:', data.length);
          return Array.isArray(data) ? data : [];
        }).catch(error => {
          console.warn('⚠️ Error cargando materiales:', error);
          return [];
        }),

        // Otros costos
        axios.get(`/api/obras/${obra.id}/otros-costos`, {
          headers: { 
            empresaId: empresaId,
            'X-Tenant-ID': empresaId 
          }
        }).then(response => {
          const data = response.data || [];
          console.log('💰 Otros costos:', data.length);
          return Array.isArray(data) ? data : [];
        }).catch(error => {
          console.warn('⚠️ Error cargando otros costos:', error);
          return [];
        }),

        // Trabajos Extra
        api.trabajosExtra.getAll(empresaId, { obraId: obra.id }).then(data => {
          console.log('🔧 Trabajos extra:', data.length);
          return Array.isArray(data) ? data : [];
        }).catch(error => {
          console.warn('⚠️ Error cargando trabajos extra:', error);
          return [];
        }),

        // Etapas diarias
        api.etapasDiarias.getAll(empresaId, { obraId: obra.id }).then(data => {
          console.log('📅 Etapas diarias:', data.length);
          return Array.isArray(data) ? data : [];
        }).catch(error => {
          console.warn('⚠️ Error cargando etapas diarias:', error);
          return [];
        })
      ]);

      // Calcular resumen
      // Usar totalFinal o totalPresupuesto del presupuesto
      const totalPresupuestado = presupuestoData?.totalFinal || 
                                 presupuestoData?.totalPresupuesto || 
                                 0;
      
      console.log('💵 Total presupuestado extraído:', totalPresupuestado);
      
      // PROCESAR PROFESIONALES - Estructura anidada con semanas
      const profesionalesProcesados = [];
      const profesionalesMap = new Map(); // Para agrupar por profesional
      
      profesionalesData.forEach(asignacion => {
        if (asignacion.asignacionesPorSemana) {
          asignacion.asignacionesPorSemana.forEach(semana => {
            if (semana.detallesPorDia) {
              semana.detallesPorDia.forEach(detalle => {
                const key = `${detalle.profesionalId}-${detalle.profesionalNombre}`;
                if (!profesionalesMap.has(key)) {
                  profesionalesMap.set(key, {
                    id: detalle.profesionalId,
                    nombre: detalle.profesionalNombre,
                    tipo: detalle.profesionalTipo,
                    jornales: 0,
                    valorJornal: detalle.importeJornal || 0 // null por ahora
                  });
                }
                const prof = profesionalesMap.get(key);
                prof.jornales += detalle.cantidad || 0;
              });
            }
          });
        }
      });
      
      // Convertir map a array
      profesionalesProcesados.push(...profesionalesMap.values());
      
      // Obtener valores de jornal desde la BD de profesionales
      const profesionalesConValores = await Promise.all(
        profesionalesProcesados.map(async (prof) => {
          try {
            if (prof.id && prof.valorJornal === 0) {
              const response = await axios.get(`/api/profesionales/${prof.id}`, {
                headers: { empresaId, 'X-Tenant-ID': empresaId }
              });
              const profData = response.data;
              prof.valorJornal = profData.honorario_dia || profData.valorHoraDefault || profData.valorJornal || 0;
            }
          } catch (error) {
            console.warn(`No se pudo obtener valor jornal para profesional ${prof.id}`);
          }
          return prof;
        })
      );
      
      // Calcular gasto de profesionales
      const gastoProfesionales = profesionalesConValores.reduce((sum, prof) => {
        const total = prof.valorJornal * prof.jornales;
        console.log(`💰 ${prof.nombre}: $${prof.valorJornal} x ${prof.jornales} jornales = $${total}`);
        return sum + total;
      }, 0);
      
      // PROCESAR MATERIALES
      console.log('📦 Materiales asignados a la obra:', materialesData.length);
      console.log('📊 Presupuesto disponible:', !!presupuestoData);
      
      const materialesProcesados = materialesData.map(mat => {
        let precioFinal = mat.precioUnitario;
        
        console.log(`🔍 Material: "${mat.nombreMaterial}" | Precio: ${mat.precioUnitario} | ID Presupuesto: ${mat.presupuestoMaterialId}`);
        
        // Si el precio es null, buscar en presupuesto
        if (precioFinal === null && presupuestoData?.itemsCalculadora && mat.presupuestoMaterialId) {
          console.log(`🔎 Buscando material ID ${mat.presupuestoMaterialId} en presupuesto...`);
          
          for (let i = 0; i < presupuestoData.itemsCalculadora.length; i++) {
            const item = presupuestoData.itemsCalculadora[i];
            
            // Los materiales están en materialesLista
            if (item.materialesLista && Array.isArray(item.materialesLista)) {
              // Buscar por ID primero
              let materialEncontrado = item.materialesLista.find(m => m.id === mat.presupuestoMaterialId);
              
              // Si no se encuentra por ID, buscar por nombre (fallback para versiones antiguas)
              if (!materialEncontrado) {
                materialEncontrado = item.materialesLista.find(m => 
                  m.nombre?.toLowerCase() === mat.nombreMaterial?.toLowerCase()
                );
                
                if (materialEncontrado) {
                  console.log(`⚠️ Material encontrado por nombre (ID no coincide: ${mat.presupuestoMaterialId} vs ${materialEncontrado.id})`);
                }
              }
              
              if (materialEncontrado) {
                precioFinal = materialEncontrado.precioUnitario || materialEncontrado.precio;
                
                // Si el precio es null pero hay subtotal y cantidad, calcular el precio unitario
                if (!precioFinal && materialEncontrado.subtotal && materialEncontrado.cantidad) {
                  precioFinal = materialEncontrado.subtotal / materialEncontrado.cantidad;
                  console.log(`💡 Precio calculado desde subtotal: $${materialEncontrado.subtotal} / ${materialEncontrado.cantidad} = $${precioFinal}`);
                }
                
                console.log(`✅ Precio encontrado: $${precioFinal || 0}`, materialEncontrado);
                break;
              }
            }
          }
          
          if (precioFinal === null) {
            console.warn(`❌ Material "${mat.nombreMaterial}" (ID ${mat.presupuestoMaterialId}) NO encontrado en presupuesto`);
          }
        }
        
        return {
          nombre: mat.nombreMaterial,
          descripcion: mat.descripcionMaterial,
          cantidad: mat.cantidadAsignada || 0,
          unidad: mat.unidadMedida || 'unidad',
          precio: precioFinal || 0
        };
      });
      
      const gastoMateriales = materialesProcesados.reduce((sum, mat) => {
        const total = mat.precio * mat.cantidad;
        console.log(`📦 ${mat.nombre}: $${mat.precio} x ${mat.cantidad} = $${total}`);
        return sum + total;
      }, 0);
      
      // PROCESAR OTROS COSTOS
      const gastoOtrosCostos = otrosCostosData.reduce((sum, costo) => {
        const monto = costo.monto || costo.valor || costo.importe || 0;
        return sum + monto;
      }, 0);
      
      // PROCESAR TRABAJOS EXTRA - El monto está en profesionales[].importe
      const trabajosExtraProcesados = trabajosExtraData.map(te => {
        const montoTotal = (te.profesionales || []).reduce((sum, prof) => {
          return sum + (prof.importe || 0);
        }, 0);
        
        return {
          nombre: te.nombre,
          descripcion: te.observaciones,
          fecha: te.fechaCreacion,
          estado: te.estado || 'PENDIENTE',
          monto: montoTotal,
          profesionales: te.profesionales || []
        };
      });
      
      const gastoTrabajosExtra = trabajosExtraProcesados.reduce((sum, te) => {
        console.log(`🔧 ${te.nombre}: $${te.monto}`);
        return sum + te.monto;
      }, 0);
      
      const totalGastado = gastoProfesionales + gastoMateriales + gastoOtrosCostos + gastoTrabajosExtra;
      
      console.log('💵 TOTALES:');
      console.log(`  Profesionales: $${gastoProfesionales}`);
      console.log(`  Materiales: $${gastoMateriales}`);
      console.log(`  Otros: $${gastoOtrosCostos}`);
      console.log(`  Trabajos Extra: $${gastoTrabajosExtra}`);
      console.log(`  TOTAL: $${totalGastado}`);
      
      // Calcular avance (etapas completadas)
      const etapasCompletadas = etapasDiariasData.filter(e => e.estado === 'COMPLETADA').length;
      const porcentajeAvance = etapasDiariasData.length > 0 
        ? (etapasCompletadas / etapasDiariasData.length) * 100 
        : 0;

      // Por ahora cobros y pagos vacíos (pueden implementarse después)
      const totalCobrado = 0;
      const totalPagado = 0;
      
      const rentabilidad = totalPresupuestado > 0 
        ? ((totalPresupuestado - totalGastado) / totalPresupuestado) * 100 
        : 0;

      setEstadisticas({
        presupuesto: presupuestoData,
        profesionales: profesionalesConValores,
        materiales: materialesProcesados,
        otrosCostos: otrosCostosData,
        trabajosExtra: trabajosExtraProcesados,
        etapasDiarias: etapasDiariasData,
        cobros: [],
        pagos: [],
        resumen: {
          totalPresupuestado,
          totalGastado,
          totalCobrado: 0,
          totalPagado: 0,
          rentabilidad,
          porcentajeAvance,
          gastoProfesionales,
          gastoMateriales,
          gastoOtrosCostos,
          gastoTrabajosExtra
        }
      });

      console.log('✅ Estadísticas cargadas correctamente');
      
      // DEBUG: Mostrar estructura de datos completa
      console.log('🔍 DEBUG - Estructura completa de datos:');
      console.log('📊 Profesionales (primero):', JSON.stringify(profesionalesData[0], null, 2));
      console.log('📦 Materiales (primero):', JSON.stringify(materialesData[0], null, 2));
      console.log('💸 Otros costos (primero):', JSON.stringify(otrosCostosData[0], null, 2));
      console.log('🔧 Trabajos extra (primero):', JSON.stringify(trabajosExtraData[0], null, 2));
      
    } catch (error) {
      console.error('❌ Error cargando estadísticas:', error);
      showNotification?.('Error al cargar estadísticas de la obra', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8', '#6610f2'];

  if (!obra) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth: '95vw' }}>
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-chart-line me-2"></i>
              Estadísticas Detalladas - {obra.nombre}
            </h5>
            <button 
              type="button" 
              className="btn btn-light btn-sm ms-auto"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">Cargando estadísticas...</span>
                </div>
                <p className="mt-3 text-muted">Cargando información detallada...</p>
              </div>
            ) : (
              <>
                {/* Panel de DEBUG - Temporal para ver estructura de datos */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="alert alert-warning mb-3">
                    <h6><i className="fas fa-bug me-2"></i>Debug Info (solo desarrollo)</h6>
                    <small>
                      <strong>Total items:</strong> {estadisticas.profesionales.length} prof. | {estadisticas.materiales.length} mat. | {estadisticas.otrosCostos.length} otros | {estadisticas.trabajosExtra.length} extras
                      <br />
                      <button 
                        className="btn btn-sm btn-outline-dark mt-2"
                        onClick={() => {
                          console.log('📋 DUMP COMPLETO:', estadisticas);
                          alert('Ver consola del navegador (F12) para estructura completa');
                        }}
                      >
                        Ver estructura en consola
                      </button>
                    </small>
                  </div>
                )}
                
                {/* Resumen General - Cards superiores */}
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="card border-primary h-100">
                      <div className="card-body text-center">
                        <i className="fas fa-file-invoice-dollar fa-2x text-primary mb-2"></i>
                        <h6 className="text-muted mb-1">Presupuestado</h6>
                        <h4 className="mb-0 text-primary">{formatCurrency(estadisticas.resumen.totalPresupuestado)}</h4>
                        {estadisticas.resumen.totalPresupuestado === 0 && (
                          <small className="text-warning">
                            <i className="fas fa-exclamation-triangle me-1"></i>
                            Sin presupuesto
                          </small>
                        )}
                        {estadisticas.presupuesto && (
                          <small className="text-muted d-block mt-1">
                            Versión {estadisticas.presupuesto.numeroVersion || estadisticas.presupuesto.version || 1}
                          </small>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-danger h-100">
                      <div className="card-body text-center">
                        <i className="fas fa-money-bill-wave fa-2x text-danger mb-2"></i>
                        <h6 className="text-muted mb-1">Gastado</h6>
                        <h4 className="mb-0 text-danger">{formatCurrency(estadisticas.resumen.totalGastado)}</h4>
                        <small className="text-muted">
                          {estadisticas.resumen.totalPresupuestado > 0 
                            ? `${((estadisticas.resumen.totalGastado / estadisticas.resumen.totalPresupuestado) * 100).toFixed(1)}% del presupuesto`
                            : 'Sin presupuesto'
                          }
                        </small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-success h-100">
                      <div className="card-body text-center">
                        <i className="fas fa-percent fa-2x text-success mb-2"></i>
                        <h6 className="text-muted mb-1">Rentabilidad</h6>
                        <h4 className={`mb-0 ${estadisticas.resumen.rentabilidad >= 0 ? 'text-success' : 'text-danger'}`}>
                          {estadisticas.resumen.rentabilidad.toFixed(1)}%
                        </h4>
                        <small className="text-muted">
                          {estadisticas.resumen.rentabilidad >= 0 ? 'Ganancia estimada' : 'Pérdida estimada'}
                        </small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-info h-100">
                      <div className="card-body text-center">
                        <i className="fas fa-tasks fa-2x text-info mb-2"></i>
                        <h6 className="text-muted mb-1">Avance</h6>
                        <h4 className="mb-0 text-info">{estadisticas.resumen.porcentajeAvance.toFixed(1)}%</h4>
                        <div className="progress mt-2" style={{ height: '8px' }}>
                          <div 
                            className="progress-bar bg-info" 
                            style={{ width: `${estadisticas.resumen.porcentajeAvance}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Distribución de Gastos */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0">
                          <i className="fas fa-chart-pie me-2"></i>
                          Distribución de Gastos
                        </h6>
                      </div>
                      <div className="card-body">
                        {estadisticas.resumen.totalGastado > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Profesionales', value: estadisticas.resumen.gastoProfesionales },
                                  { name: 'Materiales', value: estadisticas.resumen.gastoMateriales },
                                  { name: 'Otros Costos', value: estadisticas.resumen.gastoOtrosCostos },
                                  { name: 'Trabajos Extra', value: estadisticas.resumen.gastoTrabajosExtra }
                                ].filter(item => item.value > 0)}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                              >
                                {[0, 1, 2, 3].map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center text-muted py-5">
                            <i className="fas fa-info-circle fa-3x mb-3"></i>
                            <p>No hay gastos registrados</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0">
                          <i className="fas fa-dollar-sign me-2"></i>
                          Resumen de Costos
                        </h6>
                      </div>
                      <div className="card-body">
                        <table className="table table-sm">
                          <tbody>
                            <tr>
                              <td><i className="fas fa-users text-primary me-2"></i>Profesionales</td>
                              <td className="text-end fw-bold">{formatCurrency(estadisticas.resumen.gastoProfesionales)}</td>
                              <td className="text-end text-muted">
                                {estadisticas.profesionales.length} asignaciones
                              </td>
                            </tr>
                            <tr>
                              <td><i className="fas fa-box text-warning me-2"></i>Materiales</td>
                              <td className="text-end fw-bold">{formatCurrency(estadisticas.resumen.gastoMateriales)}</td>
                              <td className="text-end text-muted">
                                {estadisticas.materiales.length} items
                              </td>
                            </tr>
                            <tr>
                              <td><i className="fas fa-receipt text-danger me-2"></i>Otros Costos</td>
                              <td className="text-end fw-bold">{formatCurrency(estadisticas.resumen.gastoOtrosCostos)}</td>
                              <td className="text-end text-muted">
                                {estadisticas.otrosCostos.length} items
                              </td>
                            </tr>
                            <tr>
                              <td><i className="fas fa-tools text-secondary me-2"></i>Trabajos Extra</td>
                              <td className="text-end fw-bold">{formatCurrency(estadisticas.resumen.gastoTrabajosExtra)}</td>
                              <td className="text-end text-muted">
                                {estadisticas.trabajosExtra.length} trabajos
                              </td>
                            </tr>
                            <tr className="table-primary fw-bold">
                              <td>TOTAL GASTADO</td>
                              <td className="text-end">{formatCurrency(estadisticas.resumen.totalGastado)}</td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs con detalles */}
                <ul className="nav nav-tabs" role="tablist">
                  <li className="nav-item">
                    <button className="nav-link active" data-bs-toggle="tab" data-bs-target="#profesionales-tab">
                      <i className="fas fa-users me-1"></i>
                      Profesionales ({estadisticas.profesionales.length})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link" data-bs-toggle="tab" data-bs-target="#materiales-tab">
                      <i className="fas fa-box me-1"></i>
                      Materiales ({estadisticas.materiales.length})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link" data-bs-toggle="tab" data-bs-target="#otros-tab">
                      <i className="fas fa-receipt me-1"></i>
                      Otros Costos ({estadisticas.otrosCostos.length})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link" data-bs-toggle="tab" data-bs-target="#trabajos-tab">
                      <i className="fas fa-tools me-1"></i>
                      Trabajos Extra ({estadisticas.trabajosExtra.length})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link" data-bs-toggle="tab" data-bs-target="#etapas-tab">
                      <i className="fas fa-calendar me-1"></i>
                      Etapas ({estadisticas.etapasDiarias.length})
                    </button>
                  </li>
                </ul>

                <div className="tab-content mt-3">
                  {/* Tab Profesionales */}
                  <div className="tab-pane fade show active" id="profesionales-tab">
                    {estadisticas.profesionales.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Profesional</th>
                              <th>Rol</th>
                              <th className="text-center">Jornales</th>
                              <th className="text-end">Valor Jornal</th>
                              <th className="text-end">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estadisticas.profesionales.map((prof, idx) => {
                              const total = prof.valorJornal * prof.jornales;
                              
                              return (
                                <tr key={idx}>
                                  <td>
                                    {prof.nombre || 'Sin nombre'}
                                    {prof.id && (
                                      <small className="text-muted d-block">ID: {prof.id}</small>
                                    )}
                                  </td>
                                  <td><span className="badge bg-secondary">{prof.tipo || 'N/A'}</span></td>
                                  <td className="text-center">
                                    <span className="badge bg-primary">{prof.jornales}</span>
                                  </td>
                                  <td className="text-end">{formatCurrency(prof.valorJornal)}</td>
                                  <td className="text-end fw-bold text-primary">{formatCurrency(total)}</td>
                                </tr>
                              );
                            })}
                            <tr className="table-primary fw-bold">
                              <td colSpan="4" className="text-end">SUBTOTAL PROFESIONALES:</td>
                              <td className="text-end">{formatCurrency(estadisticas.resumen.gastoProfesionales)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay profesionales asignados a esta obra
                      </div>
                    )}
                  </div>

                  {/* Tab Materiales */}
                  <div className="tab-pane fade" id="materiales-tab">
                    {estadisticas.materiales.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Material</th>
                              <th>Descripción</th>
                              <th className="text-center">Cantidad</th>
                              <th>Unidad</th>
                              <th className="text-end">Precio Unit.</th>
                              <th className="text-end">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estadisticas.materiales.map((mat, idx) => {
                              const total = mat.precio * mat.cantidad;
                              
                              return (
                                <tr key={idx}>
                                  <td className="fw-bold">
                                    {mat.nombre}
                                    {mat.precio === 0 && (
                                      <small className="text-warning d-block">
                                        <i className="fas fa-exclamation-triangle me-1"></i>
                                        Sin precio registrado
                                      </small>
                                    )}
                                  </td>
                                  <td><small className="text-muted">{mat.descripcion || '-'}</small></td>
                                  <td className="text-center">
                                    <span className="badge bg-info text-dark">{mat.cantidad}</span>
                                  </td>
                                  <td>{mat.unidad}</td>
                                  <td className="text-end">{formatCurrency(mat.precio)}</td>
                                  <td className="text-end fw-bold text-warning">{formatCurrency(total)}</td>
                                </tr>
                              );
                            })}
                            <tr className="table-warning fw-bold">
                              <td colSpan="5" className="text-end">SUBTOTAL MATERIALES:</td>
                              <td className="text-end">{formatCurrency(estadisticas.resumen.gastoMateriales)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay materiales asignados a esta obra
                      </div>
                    )}
                  </div>

                  {/* Tab Otros Costos */}
                  <div className="tab-pane fade" id="otros-tab">
                    {estadisticas.otrosCostos.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Descripción</th>
                              <th>Categoría</th>
                              <th className="text-end">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estadisticas.otrosCostos.map((costo, idx) => {
                              const descripcion = costo.descripcion || costo.concepto || costo.detalle || 'Sin descripción';
                              const categoria = costo.categoria || costo.tipo || costo.tipoGasto || 'General';
                              const monto = costo.monto || costo.valor || costo.importe || costo.costo || 0;
                              
                              return (
                                <tr key={idx}>
                                  <td>{descripcion}</td>
                                  <td><span className="badge bg-info">{categoria}</span></td>
                                  <td className="text-end fw-bold">{formatCurrency(monto)}</td>
                                </tr>
                              );
                            })}
                            <tr className="table-danger fw-bold">
                              <td colSpan="2" className="text-end">SUBTOTAL OTROS COSTOS:</td>
                              <td className="text-end">{formatCurrency(estadisticas.resumen.gastoOtrosCostos)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay otros costos registrados en esta obra
                      </div>
                    )}
                  </div>

                  {/* Tab Trabajos Extra */}
                  <div className="tab-pane fade" id="trabajos-tab">
                    {estadisticas.trabajosExtra.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Descripción</th>
                              <th>Fecha</th>
                              <th>Estado</th>
                              <th className="text-end">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estadisticas.trabajosExtra.map((te, idx) => {
                              return (
                                <tr key={idx}>
                                  <td>
                                    <strong>{te.nombre}</strong>
                                    {te.descripcion && (
                                      <><br /><small className="text-muted">{te.descripcion}</small></>
                                    )}
                                    {te.profesionales.length > 0 && (
                                      <div className="mt-1">
                                        {te.profesionales.map((prof, pIdx) => (
                                          <small key={pIdx} className="badge bg-info me-1">
                                            {prof.nombre} - {formatCurrency(prof.importe)}
                                          </small>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td><small>{te.fecha ? new Date(te.fecha).toLocaleDateString('es-AR') : '-'}</small></td>
                                  <td>
                                    <span className={`badge ${te.estado === 'COMPLETADO' ? 'bg-success' : 'bg-warning'}`}>
                                      {te.estado}
                                    </span>
                                  </td>
                                  <td className="text-end fw-bold">{formatCurrency(te.monto)}</td>
                                </tr>
                              );
                            })}
                            <tr className="table-secondary fw-bold">
                              <td colSpan="3" className="text-end">SUBTOTAL TRABAJOS EXTRA:</td>
                              <td className="text-end">{formatCurrency(estadisticas.resumen.gastoTrabajosExtra)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay trabajos extra registrados en esta obra
                      </div>
                    )}
                  </div>

                  {/* Tab Etapas */}
                  <div className="tab-pane fade" id="etapas-tab">
                    {estadisticas.etapasDiarias.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th>Estado</th>
                              <th className="text-center">Tareas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estadisticas.etapasDiarias.map((etapa, idx) => (
                              <tr key={idx}>
                                <td><small>{etapa.fecha ? new Date(etapa.fecha).toLocaleDateString('es-AR') : '-'}</small></td>
                                <td>{etapa.descripcion || etapa.nombre || `Etapa ${idx + 1}`}</td>
                                <td>
                                  <span className={`badge ${
                                    etapa.estado === 'COMPLETADA' ? 'bg-success' : 
                                    etapa.estado === 'EN_PROCESO' ? 'bg-primary' : 'bg-secondary'
                                  }`}>
                                    {etapa.estado || 'PENDIENTE'}
                                  </span>
                                </td>
                                <td className="text-center">
                                  {etapa.tareas?.length || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-3">
                          <small className="text-muted">
                            <i className="fas fa-info-circle me-1"></i>
                            Etapas completadas: {estadisticas.etapasDiarias.filter(e => e.estado === 'COMPLETADA').length} de {estadisticas.etapasDiarias.length}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay etapas diarias programadas para esta obra
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => {
                showNotification?.('Función de exportar en desarrollo', 'info');
              }}
            >
              <i className="fas fa-download me-2"></i>
              Exportar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstadisticasObraModal;
