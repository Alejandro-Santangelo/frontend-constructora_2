import React, { useState, useEffect } from 'react';
import { Nav, Tab, Table, Spinner, Alert } from 'react-bootstrap';
import { obtenerAsignacionesSemanalPorObra } from '../services/profesionalesObraService';
import api from '../services/api';
import axios from 'axios';

const VerAsignacionesModal = ({ show, onHide, obra, obras = [], empresaId, datosAsignacionesPorObra = {} }) => {
  const [loading, setLoading] = useState(false);
  const [asignaciones, setAsignaciones] = useState(null);
  const [asignacionesTodasObras, setAsignacionesTodasObras] = useState([]);
  const [trabajosExtra, setTrabajosExtra] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [gastosGenerales, setGastosGenerales] = useState([]);
  const [loadingTrabajosExtra, setLoadingTrabajosExtra] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('general'); // 'general' o 'semanal'
  const [configuracionObra, setConfiguracionObra] = useState(null);

  // Modo: si obra es null, mostrar todas las obras
  const modoTodasObras = !obra;

  // Cargar asignaciones y trabajos extra cuando se abre el modal
  useEffect(() => {
    if (show && empresaId) {
      if (modoTodasObras) {
        cargarDatosTodasObrasDesdeCache();
      } else if (obra) {
        cargarDatosDesdeCache();
      }
    } else {
      // Resetear estados cuando se cierra el modal
      setLoading(false);
      setLoadingTrabajosExtra(false);
    }
  }, [show, obra, empresaId]);

  const cargarDatosDesdeCache = async () => {
    console.log('📦 Cargando datos desde caché para obra:', obra.id);
    setLoading(true);
    setLoadingTrabajosExtra(true);

    try {
      // Intentar obtener datos del caché primero
      const datosCache = datosAsignacionesPorObra[obra.id];

      if (datosCache) {
        console.log('✅ Datos encontrados en caché:', datosCache);

        // Usar asignaciones del caché
        if (datosCache.asignacionesProfesionales) {
          setAsignaciones({ asignacionesPorSemana: datosCache.asignacionesProfesionales });
        }

        // Usar trabajos extra del caché
        if (datosCache.trabajosExtra) {
          setTrabajosExtra(datosCache.trabajosExtra);
        }

        // Usar materiales del caché
        if (datosCache.materiales) {
          setMateriales(datosCache.materiales);
        }

        // Usar gastos generales del caché
        if (datosCache.gastosGenerales) {
          setGastosGenerales(datosCache.gastosGenerales);
        }
      } else {
        console.log('⚠️ No hay datos en caché, cargando desde backend...');
        // Fallback: cargar desde backend si no hay caché
        await cargarDatosDesdeBackend();
      }

      // Cargar configuración de la obra desde localStorage
      const configKey = `configuracionObra_${obra.id}`;
      const configGuardada = localStorage.getItem(configKey);
      if (configGuardada) {
        setConfiguracionObra(JSON.parse(configGuardada));
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      setAsignaciones(null);
      setTrabajosExtra([]);
    } finally {
      setLoading(false);
      setLoadingTrabajosExtra(false);
    }
  };

  const cargarDatosDesdeBackend = async () => {
    setLoading(true);
    setLoadingTrabajosExtra(true);

    try {
      // Cargar asignaciones de profesionales
      const dataAsignaciones = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
      setAsignaciones(dataAsignaciones);

      // Cargar configuración de la obra desde localStorage
      const configKey = `configuracionObra_${obra.id}`;
      const configGuardada = localStorage.getItem(configKey);
      if (configGuardada) {
        setConfiguracionObra(JSON.parse(configGuardada));
      }

      // Cargar trabajos extra
      try {
        const dataTrabajosExtra = await api.trabajosExtra.getAll(empresaId, { obraId: obra.id });
        setTrabajosExtra(Array.isArray(dataTrabajosExtra) ? dataTrabajosExtra : []);
      } catch (errorTrabajosExtra) {
        console.warn('No se pudieron cargar trabajos extra:', errorTrabajosExtra);
        setTrabajosExtra([]);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      setAsignaciones(null);
      setTrabajosExtra([]);
    } finally {
      setLoading(false);
      setLoadingTrabajosExtra(false);
    }
  };

  const cargarDatosTodasObrasDesdeCache = async () => {
    console.log('📦 Cargando datos de todas las obras desde backend. Total obras:', obras?.length);
    console.log('📦 Obras recibidas:', obras);
    setLoading(true);
    setLoadingTrabajosExtra(true);

    try {
      if (!obras || obras.length === 0) {
        console.warn('⚠️ No hay obras para cargar');
        setAsignacionesTodasObras([]);
        setTrabajosExtra([]);
        setMateriales([]);
        setGastosGenerales([]);
        return;
      }

      console.log('✅ Iniciando carga de datos...');
      const todasAsignaciones = [];
      const todosTrabajosExtra = [];
      const todosMateriales = [];
      const todosGastosGenerales = [];

      // Cargar datos desde el backend para cada obra
      for (const obraItem of obras) {
        try {
          console.log(`🔄 Cargando datos para obra ${obraItem.id}`);
          console.log(`  🏗️ Propiedades de la obra:`, obraItem);
          const nombreObra = obraItem.direccion || obraItem.nombre || obraItem.titulo || `Obra ${obraItem.id}`;
          console.log(`  📝 Nombre de obra a usar: "${nombreObra}"`);

          // Cargar asignaciones de profesionales
          try {
            console.log(`  📞 Llamando a obtenerAsignacionesSemanalPorObra para obra ${obraItem.id}`);
            const respuestaProfesionales = await obtenerAsignacionesSemanalPorObra(obraItem.id, empresaId);
            console.log(`  📥 Respuesta profesionales RAW:`, respuestaProfesionales);

            const dataProfesionales = respuestaProfesionales.data || respuestaProfesionales;
            console.log(`  📊 Data profesionales procesada:`, dataProfesionales);

            // El backend devuelve un array directo de profesionales, no agrupado por semana
            if (Array.isArray(dataProfesionales) && dataProfesionales.length > 0) {
              todasAsignaciones.push({
                obra: obraItem,
                asignaciones: dataProfesionales // Array directo
              });
              console.log(`  ✅ ${dataProfesionales.length} profesionales cargados para obra ${obraItem.id}, total asignaciones ahora:`, todasAsignaciones.length);
            } else if (dataProfesionales.asignacionesPorSemana && Object.keys(dataProfesionales.asignacionesPorSemana).length > 0) {
              // Fallback: si viene agrupado por semana
              todasAsignaciones.push({
                obra: obraItem,
                asignaciones: { asignacionesPorSemana: dataProfesionales.asignacionesPorSemana }
              });
              console.log(`  ✅ Profesionales agrupados cargados para obra ${obraItem.id}`);
            } else {
              console.log(`  ⚠️ No hay profesionales para obra ${obraItem.id}`);
            }
          } catch (errorProf) {
            console.warn(`  ⚠️ Error cargando profesionales de obra ${obraItem.id}:`, errorProf);
          }

          // Cargar trabajos extra
          try {
            const dataTrabajosExtra = await api.trabajosExtra.getAll(empresaId, { obraId: obraItem.id });
            if (Array.isArray(dataTrabajosExtra) && dataTrabajosExtra.length > 0) {
              const nombreObra = obraItem.direccion || obraItem.nombre || obraItem.titulo || `Obra ${obraItem.id}`;
              todosTrabajosExtra.push(...dataTrabajosExtra.map(te => ({
                ...te,
                obraDireccion: nombreObra
              })));
              console.log(`  ✅ ${dataTrabajosExtra.length} trabajos extra cargados para obra ${obraItem.id}`);
            }
          } catch (errorTE) {
            console.warn(`  ⚠️ Error cargando trabajos extra de obra ${obraItem.id}:`, errorTE.message);
          }

          // Cargar materiales
          try {
            const responseM = await axios.get(`/api/obras/${obraItem.id}/materiales`, {
              headers: {
                empresaId: empresaId,
                'X-Tenant-ID': empresaId
              }
            });
            const dataMateriales = responseM.data?.data || responseM.data || [];
            if (Array.isArray(dataMateriales) && dataMateriales.length > 0) {
              const nombreObra = obraItem.direccion || obraItem.nombre || obraItem.titulo || `Obra ${obraItem.id}`;
              todosMateriales.push(...dataMateriales.map(m => ({
                ...m,
                obraDireccion: nombreObra
              })));
              console.log(`  ✅ ${dataMateriales.length} materiales cargados para obra ${obraItem.id}`);
            }
          } catch (errorMat) {
            console.warn(`  ⚠️ Error cargando materiales de obra ${obraItem.id}:`, errorMat.message);
          }

          // Cargar gastos generales
          try {
            const responseG = await axios.get(`/api/obras/${obraItem.id}/otros-costos`, {
              headers: {
                empresaId: empresaId,
                'X-Tenant-ID': empresaId,
                'Content-Type': 'application/json'
              }
            });
            const dataGastos = responseG.data || [];
            if (Array.isArray(dataGastos) && dataGastos.length > 0) {
              const nombreObra = obraItem.direccion || obraItem.nombre || obraItem.titulo || `Obra ${obraItem.id}`;
              todosGastosGenerales.push(...dataGastos.map(g => ({
                ...g,
                obraDireccion: nombreObra
              })));
              console.log(`  ✅ ${dataGastos.length} gastos cargados para obra ${obraItem.id}`);
            }
          } catch (errorGas) {
            console.warn(`  ⚠️ Error cargando gastos de obra ${obraItem.id}:`, errorGas.message);
          }

        } catch (errorObra) {
          console.error(`❌ Error general procesando obra ${obraItem.id}:`, errorObra);
        }
      }

      console.log(`✅ Total cargado: ${todasAsignaciones.length} obras con profesionales, ${todosTrabajosExtra.length} trabajos extra, ${todosMateriales.length} materiales, ${todosGastosGenerales.length} gastos`);

      setAsignacionesTodasObras(todasAsignaciones);
      setTrabajosExtra(todosTrabajosExtra);
      setMateriales(todosMateriales);
      setGastosGenerales(todosGastosGenerales);
    } catch (error) {
      console.error('Error cargando datos de todas las obras:', error);
      setAsignacionesTodasObras([]);
      setTrabajosExtra([]);
      setMateriales([]);
      setGastosGenerales([]);
    } finally {
      setLoading(false);
      setLoadingTrabajosExtra(false);
    }
  };

  // Procesar datos para vista general
  const obtenerResumenGeneral = () => {
    console.log('🔍 obtenerResumenGeneral - asignaciones:', asignaciones);

    if (!asignaciones || !asignaciones.asignacionesPorSemana) {
      console.warn('⚠️ No hay asignaciones o asignacionesPorSemana');
      return { profesionales: [], totalJornales: 0, semanasConAsignaciones: 0 };
    }

    console.log('🔍 asignacionesPorSemana:', asignaciones.asignacionesPorSemana);
    console.log('🔍 Keys:', Object.keys(asignaciones.asignacionesPorSemana));

    const profesionalesMap = new Map();
    let totalJornales = 0;
    let semanasConAsignaciones = 0;

    Object.entries(asignaciones.asignacionesPorSemana).forEach(([semanaKey, semanaData]) => {
      console.log(`🔍 Procesando semana ${semanaKey}:`, semanaData);

      if (semanaData.detallesPorDia && Object.keys(semanaData.detallesPorDia).length > 0) {
        semanasConAsignaciones++;

        Object.values(semanaData.detallesPorDia).forEach(diaData => {
          console.log('🔍 Día data:', diaData);

          if (diaData.profesionales) {
            console.log('🔍 Profesionales en día:', diaData.profesionales);

            diaData.profesionales.forEach(prof => {
              const key = prof.profesionalId || prof.id;
              if (!profesionalesMap.has(key)) {
                profesionalesMap.set(key, {
                  id: key,
                  nombre: prof.nombreProfesional || prof.nombre || 'Sin nombre',
                  tipo: prof.tipoProfesional || prof.tipo || 'Sin tipo',
                  totalJornales: 0,
                  semanas: new Set()
                });
              }

              const cantidad = parseInt(prof.cantidad) || 0;
              profesionalesMap.get(key).totalJornales += cantidad;
              profesionalesMap.get(key).semanas.add(semanaKey);
              totalJornales += cantidad;
            });
          }
        });
      }
    });

    const profesionalesArray = Array.from(profesionalesMap.values()).map(prof => ({
      ...prof,
      cantidadSemanas: prof.semanas.size
    })).sort((a, b) => b.totalJornales - a.totalJornales);

    return {
      profesionales: profesionalesArray,
      totalJornales,
      semanasConAsignaciones,
      totalProfesionales: profesionalesArray.length
    };
  };

  // Procesar datos para vista semanal
  const obtenerResumenSemanal = () => {
    if (!asignaciones || !asignaciones.asignacionesPorSemana) {
      return [];
    }

    const semanas = [];
    Object.entries(asignaciones.asignacionesPorSemana).forEach(([semanaKey, semanaData]) => {
      const profesionalesMap = new Map();
      let totalJornalesSemana = 0;

      if (semanaData.detallesPorDia) {
        Object.values(semanaData.detallesPorDia).forEach(diaData => {
          if (diaData.profesionales) {
            diaData.profesionales.forEach(prof => {
              const key = prof.profesionalId || prof.id;
              if (!profesionalesMap.has(key)) {
                profesionalesMap.set(key, {
                  id: key,
                  nombre: prof.nombreProfesional || prof.nombre || 'Sin nombre',
                  tipo: prof.tipoProfesional || prof.tipo || 'Sin tipo',
                  jornales: 0
                });
              }

              const cantidad = parseInt(prof.cantidad) || 0;
              profesionalesMap.get(key).jornales += cantidad;
              totalJornalesSemana += cantidad;
            });
          }
        });
      }

      if (profesionalesMap.size > 0) {
        semanas.push({
          semanaKey,
          profesionales: Array.from(profesionalesMap.values()).sort((a, b) => b.jornales - a.jornales),
          totalJornales: totalJornalesSemana
        });
      }
    });

    return semanas.sort((a, b) => a.semanaKey.localeCompare(b.semanaKey));
  };

  // Procesar datos para vista general de todas las obras
  const obtenerResumenGeneralTodasObras = () => {
    console.log('🔍 obtenerResumenGeneralTodasObras - asignacionesTodasObras:', asignacionesTodasObras);

    if (!asignacionesTodasObras || asignacionesTodasObras.length === 0) {
      console.warn('⚠️ No hay asignacionesTodasObras');
      return { obrasSummary: [], totalProfesionales: 0, totalJornales: 0, totalObras: 0 };
    }

    const obrasSummary = asignacionesTodasObras.map(({ obra, asignaciones }) => {
      console.log(`🔍 Procesando obra ${obra.id} - ${obra.direccion}:`, asignaciones);

      const profesionalesMap = new Map();
      let totalJornales = 0;

      // Caso 1: Array directo de profesionales (formato actual del backend)
      if (Array.isArray(asignaciones)) {
        console.log(`  📋 Formato array directo con ${asignaciones.length} profesionales`);
        console.log(`  📋 Primer profesional (RAW):`, asignaciones[0]);

        asignaciones.forEach((prof, idx) => {
          if (idx === 0) {
            console.log(`  🔍 Campos disponibles:`, Object.keys(prof));

            // Ver si hay profesionalObra o similar
            if (prof.profesionalObra) console.log(`  👷 profesionalObra:`, prof.profesionalObra);
            if (prof.profesional_obra) console.log(`  👷 profesional_obra:`, prof.profesional_obra);
            if (prof.profesional) console.log(`  👷 profesional:`, prof.profesional);

            // Ver en asignacionesPorSemana
            if (prof.asignacionesPorSemana?.[0]) {
              console.log(`  📅 Primera semana:`, prof.asignacionesPorSemana[0]);
              if (prof.asignacionesPorSemana[0].detallesPorDia?.[0]) {
                console.log(`  📆 Primer detalle:`, prof.asignacionesPorSemana[0].detallesPorDia[0]);
              }
            }
          }

          // ✅ Los datos del profesional están en asignacionesPorSemana -> detallesPorDia
          let nombre = 'Sin nombre';
          let tipo = 'Sin tipo';
          let rubro = null;
          let profesionalId = null;
          let fechaDesde = null;
          let fechaHasta = null;
          const todasFechas = [];

          // Buscar en detallesPorDia el primer registro con datos del profesional
          if (prof.asignacionesPorSemana) {
            for (const semana of prof.asignacionesPorSemana) {
              if (semana.detallesPorDia && semana.detallesPorDia.length > 0) {
                semana.detallesPorDia.forEach(detalle => {
                  // Logging para ver campos disponibles (solo primera vez)
                  if (idx === 0 && todasFechas.length === 0) {
                    console.log('  🔍 Campos en detalle:', Object.keys(detalle));
                    console.log('  🔍 Detalle completo:', detalle);
                  }

                  if (!nombre || nombre === 'Sin nombre') {
                    nombre = detalle.profesionalNombre || nombre;
                    tipo = detalle.profesionalTipo || tipo;
                    rubro = detalle.profesionalRubro || detalle.rubro || detalle.rubros || rubro;
                    profesionalId = detalle.profesionalId || profesionalId;
                  }

                  // Recolectar todas las fechas
                  if (detalle.fecha) {
                    todasFechas.push(detalle.fecha);
                  }
                });
              }
            }

            // Obtener fecha mínima y máxima
            if (todasFechas.length > 0) {
              todasFechas.sort();
              fechaDesde = todasFechas[0];
              fechaHasta = todasFechas[todasFechas.length - 1];
            }
          }

          const key = prof.asignacionId || profesionalId;
          const tipoAsignacion = prof.modalidad || 'completa';
          const nombreObra = obra.direccion || obra.nombre || obra.titulo || `Obra ${obra.id}`;

          console.log(`  👤 Profesional ${idx + 1}:`, {
            key,
            nombre,
            tipo,
            tipoAsignacion,
            total: prof.totalJornalesAsignados
          });

          if (!profesionalesMap.has(key)) {
            profesionalesMap.set(key, {
              id: key,
              nombre: nombre,
              tipo: tipo,
              rubro: rubro,
              nombreObra: nombreObra,
              tipoAsignacion: tipoAsignacion,
              fechaDesde: fechaDesde,
              fechaHasta: fechaHasta,
              jornales: 0
            });
          }

          const cantidad = prof.totalJornalesAsignados || parseInt(prof.cantidad) || parseInt(prof.cantidadJornales) || parseInt(prof.cantidad_jornales) || 1;
          profesionalesMap.get(key).jornales += cantidad;
          totalJornales += cantidad;
        });
      }
      // Caso 2: Formato agrupado por semana (fallback)
      else if (asignaciones && asignaciones.asignacionesPorSemana) {
        console.log(`  📅 asignacionesPorSemana keys:`, Object.keys(asignaciones.asignacionesPorSemana));

        Object.values(asignaciones.asignacionesPorSemana).forEach(semanaData => {
          if (semanaData.detallesPorDia) {
            Object.values(semanaData.detallesPorDia).forEach(diaData => {
              if (diaData.profesionales) {
                diaData.profesionales.forEach(prof => {
                  const key = prof.profesionalId || prof.id;
                  if (!profesionalesMap.has(key)) {
                    profesionalesMap.set(key, {
                      nombre: prof.nombreProfesional || prof.nombre || 'Sin nombre',
                      tipo: prof.tipoProfesional || prof.tipo || 'Sin tipo',
                      jornales: 0
                    });
                  }
                  const cantidad = parseInt(prof.cantidad) || 0;
                  profesionalesMap.get(key).jornales += cantidad;
                  totalJornales += cantidad;
                });
              }
            });
          }
        });
      }

      const result = {
        obra,
        profesionales: Array.from(profesionalesMap.values()),
        totalProfesionales: profesionalesMap.size,
        totalJornales
      };

      console.log(`  ✅ Resultado obra ${obra.id}:`, result);
      return result;
    }).filter(item => item.totalProfesionales > 0);

    console.log('📊 obrasSummary filtrado:', obrasSummary);

    const totalProfesionalesUnicos = new Set();
    obrasSummary.forEach(item => {
      item.profesionales.forEach(prof => totalProfesionalesUnicos.add(prof.nombre));
    });

    const resultado = {
      obrasSummary,
      totalProfesionales: totalProfesionalesUnicos.size,
      totalJornales: obrasSummary.reduce((sum, item) => sum + item.totalJornales, 0),
      totalObras: obrasSummary.length
    };

    console.log('✅ Resultado final obtenerResumenGeneralTodasObras:', resultado);
    return resultado;
  };

  const resumenGeneral = modoTodasObras ? obtenerResumenGeneralTodasObras() : obtenerResumenGeneral();
  const resumenSemanal = modoTodasObras ? [] : obtenerResumenSemanal();

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-scrollable" style={{ maxWidth: '95vw', width: '95vw' }}>
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-eye me-2"></i>
              {modoTodasObras ? 'Ver Asignaciones - Todas las Obras' : `Ver Asignaciones - ${obra?.direccion || 'Obra'}`}
            </h5>
            <button
              type="button"
              className="btn btn-light btn-sm ms-auto"
              onClick={onHide}
            >
              Cerrar
            </button>
          </div>

          <div className="modal-body">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">Cargando asignaciones...</p>
          </div>
        ) : (
          <>
            {/* Información de configuración - solo para obra individual */}
            {!modoTodasObras && configuracionObra && (
              <Alert variant="info" className="mb-3">
                <div className="row">
                  <div className="col-md-3">
                    <strong>Semanas Objetivo:</strong> {configuracionObra.semanasObjetivo}
                  </div>
                  <div className="col-md-3">
                    <strong>Días Hábiles:</strong> {configuracionObra.diasHabiles}
                  </div>
                  {configuracionObra.fechaInicio && (
                    <div className="col-md-6">
                      <strong>Fecha Inicio:</strong> {new Date(configuracionObra.fechaInicio).toLocaleDateString('es-ES')}
                    </div>
                  )}
                </div>
              </Alert>
            )}

            {/* Tabs para cambiar entre vistas */}
            <Tab.Container activeKey={vistaActiva} onSelect={(k) => setVistaActiva(k)}>
              <Nav variant="tabs" className="mb-3">
                <Nav.Item>
                  <Nav.Link eventKey="general">
                    <i className="fas fa-list me-2"></i>
                    Vista General
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="profesionales">
                    <i className="fas fa-users me-2"></i>
                    Profesionales
                  </Nav.Link>
                </Nav.Item>
                {!modoTodasObras && (
                  <Nav.Item>
                    <Nav.Link eventKey="semanal">
                      <i className="fas fa-calendar-week me-2"></i>
                      Por Semana
                    </Nav.Link>
                  </Nav.Item>
                )}
                <Nav.Item>
                  <Nav.Link eventKey="trabajos-extra">
                    <i className="fas fa-plus-circle me-2"></i>
                    Trabajos Extra
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="materiales">
                    <i className="fas fa-boxes me-2"></i>
                    Materiales
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="gastos">
                    <i className="fas fa-money-bill-wave me-2"></i>
                    Gastos Generales
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              <Tab.Content>
                {/* Vista General */}
                <Tab.Pane eventKey="general">
                  {modoTodasObras ? (
                    /* Vista General - Todas las Obras */
                    <>
                      <div className="mb-3">
                        <h5>Resumen de Todas las Obras</h5>
                        <div className="row">
                          <div className="col-md-3">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Total Obras</h6>
                                <h3 className="mb-0">{resumenGeneral.totalObras}</h3>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Total Profesionales</h6>
                                <h3 className="mb-0">{resumenGeneral.totalProfesionales}</h3>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Total Jornales</h6>
                                <h3 className="mb-0">{resumenGeneral.totalJornales}</h3>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Trabajos Extra</h6>
                                <h3 className="mb-0">{trabajosExtra.length}</h3>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {resumenGeneral.obrasSummary && resumenGeneral.obrasSummary.length > 0 ? (
                        <div>
                          {resumenGeneral.obrasSummary.map((obraItem, index) => (
                            <div key={obraItem.obra.id} className="mb-4">
                                <div>
                                  <Table striped bordered hover size="sm">
                                    <thead className="bg-light">
                                      <tr>
                                        <th style={{width: '50px'}}>#</th>
                                        <th>Obra</th>
                                        <th>Nombre</th>
                                        <th style={{width: '120px'}}>Tipo</th>
                                        <th className="text-center" style={{width: '150px'}}>Período</th>
                                        <th className="text-center" style={{width: '80px'}}>Jornales</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {obraItem.profesionales.map((prof, idx) => (
                                        <tr key={idx}>
                                          <td>{idx + 1}</td>
                                          <td>{prof.nombreObra || obraItem.obra.direccion}</td>
                                          <td>{prof.nombre}</td>
                                          <td>
                                            <span className="badge bg-secondary">{prof.tipo}</span>
                                          </td>
                                          <td className="text-center">
                                            {prof.fechaDesde && prof.fechaHasta ? (
                                              <small>
                                                {new Date(prof.fechaDesde).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                {' → '}
                                                {new Date(prof.fechaHasta).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                              </small>
                                            ) : '-'}
                                          </td>
                                          <td className="text-center">
                                            <strong>{prof.jornales}</strong>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Alert variant="warning">
                          <i className="fas fa-info-circle me-2"></i>
                          No hay asignaciones en ninguna obra.
                        </Alert>
                      )}
                    </>
                  ) : (
                    /* Vista General - Una Obra */
                    <>
                      <div className="mb-3">
                        <h5>Resumen de Asignaciones</h5>
                        <div className="row">
                          <div className="col-md-4">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Total Profesionales</h6>
                                <h3 className="mb-0">{resumenGeneral.totalProfesionales}</h3>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Total Jornales</h6>
                                <h3 className="mb-0">{resumenGeneral.totalJornales}</h3>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="card bg-light">
                              <div className="card-body text-center">
                                <h6 className="text-muted">Semanas con Asignaciones</h6>
                                <h3 className="mb-0">{resumenGeneral.semanasConAsignaciones}</h3>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {resumenGeneral.profesionales && resumenGeneral.profesionales.length > 0 ? (
                        <div className="table-responsive">
                          <Table striped bordered hover>
                        <thead className="bg-light">
                          <tr>
                            <th>#</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th className="text-center">Total Jornales</th>
                            <th className="text-center">Semanas Asignadas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumenGeneral.profesionales.map((prof, index) => (
                            <tr key={prof.id}>
                              <td>{index + 1}</td>
                              <td>{prof.nombre}</td>
                              <td>
                                <span className="badge bg-secondary">{prof.tipo}</span>
                              </td>
                              <td className="text-center">
                                <strong>{prof.totalJornales}</strong>
                              </td>
                              <td className="text-center">
                                {prof.cantidadSemanas}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-light">
                          <tr>
                            <th colSpan="3" className="text-end">TOTALES:</th>
                            <th className="text-center">{resumenGeneral.totalJornales}</th>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  ) : (
                    <Alert variant="warning">
                      <i className="fas fa-info-circle me-2"></i>
                      No hay profesionales asignados a esta obra.
                    </Alert>
                  )}
                    </>
                  )}
                </Tab.Pane>

                {/* Vista Profesionales */}
                <Tab.Pane eventKey="profesionales">
                  {modoTodasObras ? (
                    /* Profesionales - Todas las Obras */
                    resumenGeneral.obrasSummary && resumenGeneral.obrasSummary.length > 0 ? (
                      <div className="accordion" id="accordionObrasProfesionales">
                        {resumenGeneral.obrasSummary.map((obraItem, index) => (
                          <div className="accordion-item" key={`prof-${obraItem.obra.id}`}>
                            <h2 className="accordion-header">
                              <button
                                className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target={`#collapse-prof-${obraItem.obra.id}`}
                                aria-expanded={index === 0}
                              >
                                <strong>{obraItem.obra.direccion}</strong>
                                <span className="ms-3 badge bg-primary">
                                  {obraItem.totalProfesionales} profesionales
                                </span>
                                <span className="ms-2 badge bg-success">
                                  {obraItem.totalJornales} jornales
                                </span>
                              </button>
                            </h2>
                            <div
                              id={`collapse-prof-${obraItem.obra.id}`}
                              className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                              data-bs-parent="#accordionObrasProfesionales"
                            >
                              <div className="accordion-body">
                                <Table striped bordered hover>
                                  <thead className="bg-light">
                                    <tr>
                                      <th style={{width: '50px'}}>#</th>
                                      <th>Obra</th>
                                      <th>Nombre</th>
                                      <th className="text-center" style={{width: '140px'}}>Tipo Profesional</th>
                                      <th className="text-center" style={{width: '150px'}}>Período</th>
                                      <th className="text-center" style={{width: '120px'}}>Asignación</th>
                                      <th className="text-center" style={{width: '80px'}}>Jornales</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {obraItem.profesionales.map((prof, idx) => (
                                      <tr key={`${obraItem.obra.id}-${prof.id || idx}`}>
                                        <td>{idx + 1}</td>
                                        <td>{prof.nombreObra || obraItem.obra.direccion}</td>
                                        <td>{prof.nombre}</td>
                                        <td className="text-center">
                                          <span className="badge bg-secondary">{prof.tipo}</span>
                                        </td>
                                        <td className="text-center">
                                          {prof.fechaDesde && prof.fechaHasta ? (
                                            <small>
                                              {new Date(prof.fechaDesde).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                              {' → '}
                                              {new Date(prof.fechaHasta).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </small>
                                          ) : '-'}
                                        </td>
                                        <td className="text-center">
                                          <span className="badge bg-info">
                                            {prof.tipoAsignacion === 'semanal' ? 'Semanal' : 'Obra Completa'}
                                          </span>
                                        </td>
                                        <td className="text-center">
                                          <strong>{prof.jornales}</strong>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Alert variant="warning">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay profesionales asignados en ninguna obra.
                      </Alert>
                    )
                  ) : (
                    /* Profesionales - Obra Individual */
                    resumenGeneral.profesionales && resumenGeneral.profesionales.length > 0 ? (
                      <div className="table-responsive">
                        <Table striped bordered hover>
                          <thead className="bg-light">
                            <tr>
                              <th>#</th>
                              <th>Nombre</th>
                              <th className="text-center">Tipo Profesional</th>
                              <th className="text-center">Rubro</th>
                              <th className="text-center">Asignación</th>
                              <th className="text-center">Jornales</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumenGeneral.profesionales.map((prof, index) => (
                              <tr key={prof.id || index}>
                                <td>{index + 1}</td>
                                <td>{prof.nombre}</td>
                                <td className="text-center">
                                  <span className="badge bg-secondary">{prof.tipo}</span>
                                </td>
                                <td className="text-center">{prof.rubro || '-'}</td>
                                <td className="text-center">
                                  <span className="badge bg-info">
                                    {prof.tipoAsignacion === 'semanal' ? 'Semanal' : 'Obra Completa'}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <strong>{prof.totalJornales || prof.jornales}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    ) : (
                      <Alert variant="warning">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay profesionales asignados a esta obra.
                      </Alert>
                    )
                  )}
                </Tab.Pane>

                {/* Vista Semanal - Solo para obra individual */}
                {!modoTodasObras && (
                <Tab.Pane eventKey="semanal">
                  {resumenSemanal.length > 0 ? (
                    <div className="accordion" id="accordionSemanas">
                      {resumenSemanal.map((semana, index) => (
                        <div className="accordion-item" key={semana.semanaKey}>
                          <h2 className="accordion-header">
                            <button
                              className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target={`#collapse-${semana.semanaKey}`}
                              aria-expanded={index === 0}
                            >
                              <strong>{semana.semanaKey}</strong>
                              <span className="ms-3 badge bg-primary">
                                {semana.profesionales.length} profesionales
                              </span>
                              <span className="ms-2 badge bg-success">
                                {semana.totalJornales} jornales
                              </span>
                            </button>
                          </h2>
                          <div
                            id={`collapse-${semana.semanaKey}`}
                            className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                            data-bs-parent="#accordionSemanas"
                          >
                            <div className="accordion-body">
                              <Table striped bordered hover size="sm">
                                <thead className="bg-light">
                                  <tr>
                                    <th>#</th>
                                    <th>Nombre</th>
                                    <th>Tipo</th>
                                    <th className="text-center">Jornales</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {semana.profesionales.map((prof, idx) => (
                                    <tr key={prof.id}>
                                      <td>{idx + 1}</td>
                                      <td>{prof.nombre}</td>
                                      <td>
                                        <span className="badge bg-secondary">{prof.tipo}</span>
                                      </td>
                                      <td className="text-center">
                                        <strong>{prof.jornales}</strong>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert variant="warning">
                      <i className="fas fa-info-circle me-2"></i>
                      No hay asignaciones semanales registradas.
                    </Alert>
                  )}
                </Tab.Pane>
                )}

                {/* Vista Trabajos Extra */}
                <Tab.Pane eventKey="trabajos-extra">
                  {loadingTrabajosExtra ? (
                    <div className="text-center py-3">
                      <Spinner animation="border" size="sm" variant="primary" />
                      <span className="ms-2">Cargando trabajos extra...</span>
                    </div>
                  ) : trabajosExtra.length > 0 ? (
                    <div className="table-responsive">
                      <Table striped bordered hover>
                        <thead className="bg-light">
                          <tr>
                            <th>#</th>
                            {modoTodasObras && <th>Obra</th>}
                            <th>Título del Trabajo</th>
                            <th>Profesional</th>
                            <th className="text-center">Tipo Profesional</th>
                            <th className="text-center">Días</th>
                            <th className="text-center">Fecha Creación</th>
                            <th className="text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trabajosExtra.map((trabajo, index) => {
                            const profesionales = trabajo.profesionales || [];
                            const cantidadDias = Array.isArray(trabajo.dias) ? trabajo.dias.length : (trabajo.cantidadDias || 0);

                            return profesionales.length > 0 ? (
                              profesionales.map((prof, profIdx) => (
                                <tr key={`${trabajo.id}-${profIdx}`}>
                                  {profIdx === 0 && (
                                    <>
                                      <td rowSpan={profesionales.length}>{index + 1}</td>
                                      {modoTodasObras && <td rowSpan={profesionales.length}>{trabajo.obraDireccion || 'N/A'}</td>}
                                      <td rowSpan={profesionales.length}><strong>{trabajo.nombre || trabajo.descripcion || 'Sin título'}</strong></td>
                                    </>
                                  )}
                                  <td>{prof.nombre || 'Sin nombre'}</td>
                                  <td className="text-center">
                                    <span className="badge bg-secondary">
                                      {prof.especialidad || prof.tipo || 'General'}
                                    </span>
                                  </td>
                                  {profIdx === 0 && (
                                    <>
                                      <td className="text-center" rowSpan={profesionales.length}>{cantidadDias}</td>
                                      <td className="text-center" rowSpan={profesionales.length}>
                                        {trabajo.fechaCreacion || trabajo.created_at || trabajo.fecha ? (
                                          new Date(trabajo.fechaCreacion || trabajo.created_at || trabajo.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                        ) : '-'}
                                      </td>
                                      <td className="text-center" rowSpan={profesionales.length}>
                                        <span className={`badge ${trabajo.estado === 'completado' ? 'bg-success' : 'bg-warning'}`}>
                                          {trabajo.estado || 'Pendiente'}
                                        </span>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))
                            ) : (
                              <tr key={trabajo.id}>
                                <td>{index + 1}</td>
                                {modoTodasObras && <td>{trabajo.obraDireccion || 'N/A'}</td>}
                                <td><strong>{trabajo.nombre || trabajo.descripcion || 'Sin título'}</strong></td>
                                <td className="text-muted">Sin profesionales</td>
                                <td className="text-center">-</td>
                                <td className="text-center">{cantidadDias}</td>
                                <td className="text-center">
                                  {trabajo.fechaCreacion || trabajo.created_at || trabajo.fecha ? (
                                    new Date(trabajo.fechaCreacion || trabajo.created_at || trabajo.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                  ) : '-'}
                                </td>
                                <td className="text-center">
                                  <span className={`badge ${trabajo.estado === 'completado' ? 'bg-success' : 'bg-warning'}`}>
                                    {trabajo.estado || 'Pendiente'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <Alert variant="info">
                      <i className="fas fa-info-circle me-2"></i>
                      No hay trabajos extra registrados.
                    </Alert>
                  )}
                </Tab.Pane>

                {/* Vista Materiales */}
                <Tab.Pane eventKey="materiales">
                  {materiales.length > 0 ? (
                    <div className="table-responsive">
                      <Table striped bordered hover>
                        <thead className="bg-light">
                          <tr>
                            <th>#</th>
                            <th>Obra</th>
                            <th>Material</th>
                            <th className="text-center">Cantidad</th>
                            <th className="text-center">Unidad</th>
                            <th className="text-center">Fecha Asignación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materiales.map((material, index) => (
                            <tr key={material.id || index}>
                              <td>{index + 1}</td>
                              <td>{material.obraDireccion || 'N/A'}</td>
                              <td><strong>{material.nombre || material.nombreMaterial || 'Sin nombre'}</strong></td>
                              <td className="text-center">{material.cantidad || material.cantidadAsignada || 0}</td>
                              <td className="text-center">{material.unidad || 'unidad'}</td>
                              <td className="text-center">
                                {material.fechaAsignacion || material.created_at || material.fecha ? (
                                  new Date(material.fechaAsignacion || material.created_at || material.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <Alert variant="info">
                      <i className="fas fa-info-circle me-2"></i>
                      No hay materiales asignados.
                    </Alert>
                  )}
                </Tab.Pane>

                {/* Vista Gastos Generales */}
                <Tab.Pane eventKey="gastos">
                  {gastosGenerales.length > 0 ? (
                    <div className="table-responsive">
                      <Table striped bordered hover>
                        <thead className="bg-light">
                          <tr>
                            <th>#</th>
                            <th>Obra</th>
                            <th>Concepto</th>
                            <th>Descripción</th>
                            <th className="text-center">Cantidad</th>
                            <th className="text-center">Fecha</th>
                            <th className="text-center">Categoría</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gastosGenerales.map((gasto, index) => (
                            <tr key={gasto.id || index}>
                              <td>{index + 1}</td>
                              <td>{gasto.obraDireccion || 'N/A'}</td>
                              <td><strong>{gasto.concepto || gasto.nombre || 'Sin concepto'}</strong></td>
                              <td>{gasto.descripcion || '-'}</td>
                              <td className="text-center">{gasto.cantidad || gasto.cantidadAsignada || 1}</td>
                              <td className="text-center">
                                {gasto.fecha ? new Date(gasto.fecha).toLocaleDateString('es-ES') :
                                 gasto.fechaAsignacion ? new Date(gasto.fechaAsignacion).toLocaleDateString('es-ES') : '-'}
                              </td>
                              <td className="text-center">
                                <span className="badge bg-secondary">
                                  {gasto.categoria || gasto.tipo || 'General'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <Alert variant="info">
                      <i className="fas fa-info-circle me-2"></i>
                      No hay gastos generales registrados.
                    </Alert>
                  )}
                </Tab.Pane>
              </Tab.Content>
            </Tab.Container>
          </>
        )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onHide}
            >
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerAsignacionesModal;
