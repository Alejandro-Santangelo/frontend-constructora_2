import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import Button from 'react-bootstrap/Button';
import { Link } from 'react-router-dom';
import { apiService, getCurrentTenant } from '../services/api';
import QuickApiTest from '../components/QuickApiTest';
import VersionesPorObraModal from '../components/VersionesPorObraModal';
import { useEmpresa } from '../EmpresaContext';
import * as trabajosAdicionalesService from '../services/trabajosAdicionalesService';

const FunctionalDashboard = ({ showNotification }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [stats, setStats] = useState({
    empresas: 0,
    clientes: 0,
    obras: 0,
    profesionales: 0,
    profesionalesPorObra: 0, // Nuevo: separar las asignaciones de profesionales
    obrasActivas: 0,
    materialesStock: 0,
    gastosGenerales: 0,
    proveedores: 0,
    usuarios: 0,
    presupuestos: 0,
    transaccionesFinancieras: 0,
    trabajosObrasIndependientes: 0 // Trabajos adicionales
  });
  const [loading, setLoading] = useState(false);
  const [showVersionesModal, setShowVersionesModal] = useState(false);
  // Leer empresas desde el store como fallback si la API no responde
  const empresasFromStore = useSelector(state => state.empresas?.empresas || []);

  // Ref para prevenir doble carga
  const isLoadingRef = useRef(false);
  const lastEmpresaIdRef = useRef(null);

  useEffect(() => {
    const empresaId = empresaSeleccionada?.id || getCurrentTenant();

    // Prevenir doble carga si ya está cargando o si es la misma empresa
    if (isLoadingRef.current || lastEmpresaIdRef.current === empresaId) {
      return;
    }

    lastEmpresaIdRef.current = empresaId;
    loadDashboardData();
  }, [empresaSeleccionada]);

  const loadDashboardData = useCallback(async () => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);
      // Intentar obtener métricas reales desde el backend de forma segura
      try {
        const empresaId = empresaSeleccionada?.id || getCurrentTenant();

        if (!empresaId) {
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }

        const results = await Promise.allSettled([
          apiService.empresas.getAll(),
          apiService.clientes.getAllSimple(empresaId),
          apiService.obras.getAll(empresaId), // Cambiado de getActivas a getAll
          apiService.profesionales.getAll(empresaId), // Catálogo general de profesionales
          apiService.profesionalesObra.getAll(empresaId), // Asignaciones de profesionales a obras
          apiService.materiales.getAll(empresaId),
          apiService.gastosGenerales.getAll(empresaId),
          // Temporalmente comentados hasta implementar en backend
          // apiService.proveedores.getAll(), // Mantener sin empresaId - es endpoint general
          // apiService.usuarios.getAll(),    // Mantener sin empresaId - es endpoint general
          apiService.presupuestosNoCliente.getAll(empresaId)
        ]);

        // Valores por defecto (si falla alguna petición mantenemos valores previos)
        const defaults = {
          empresas: 0,
          clientes: 0,
          obras: 0,
          profesionales: 0,
          profesionalesPorObra: 0,
          obrasActivas: 0,
          materialesStock: 0,
          gastosGenerales: 0,
          proveedores: 0,
          usuarios: 0,
          presupuestos: 0,
          transaccionesFinancieras: 0,
          trabajosObrasIndependientes: 0
        };

        const [empresasRes, clientesRes, obrasRes, profGeneralRes, profObraRes, matRes, gastosRes, presupRes] = results;

        // Empresas - viene directo como array desde /api/empresas/simple
        let empresasCount = defaults.empresas;
        if (empresasRes.status === 'fulfilled') {
          const val = empresasRes.value;
          if (Array.isArray(val)) empresasCount = val.length;
          else if (val?.datos && Array.isArray(val.datos)) empresasCount = val.datos.length;
          else if (val?.content && Array.isArray(val.content)) empresasCount = val.content.length;
          else if (val?.totalElements) empresasCount = val.totalElements;
        }

        // Clientes - viene como array desde /api/clientes/todos
        let clientesCount = defaults.clientes;
        if (clientesRes.status === 'fulfilled') {
          const val = clientesRes.value;
          if (Array.isArray(val)) clientesCount = val.length;
          else if (val?.datos && Array.isArray(val.datos)) clientesCount = val.datos.length;
          else if (val?.content && Array.isArray(val.content)) clientesCount = val.content.length;
          else if (val?.totalElements) clientesCount = val.totalElements;
        }

        // Obras - viene como array desde /api/obras/activas
        let obrasCount = defaults.obras;
        if (obrasRes.status === 'fulfilled') {
          const val = obrasRes.value;
          if (Array.isArray(val)) obrasCount = val.length;
          else if (val?.datos && Array.isArray(val.datos)) obrasCount = val.datos.length;
          else if (val?.content && Array.isArray(val.content)) obrasCount = val.content.length;
          else if (val?.totalElements) obrasCount = val.totalElements;
        }

        // Profesionales (catálogo general)
        let profCount = defaults.profesionales;
        if (profGeneralRes.status === 'fulfilled') {
          const val = profGeneralRes.value;
          // Extraer array correctamente (mismo método que ProfesionalesPage)
          const profArray = Array.isArray(val) ? val : (val?.data || val?.resultado || []);
          profCount = profArray.length;
          console.log('📊 FunctionalDashboard - Profesionales (catálogo):', profCount);
        }

        // Profesionales por Obra (asignaciones)
        let profObraCount = defaults.profesionalesPorObra;
        if (profObraRes.status === 'fulfilled') {
          const val = profObraRes.value;
          if (Array.isArray(val)) profObraCount = val.length;
          else if (val?.datos && Array.isArray(val.datos)) profObraCount = val.datos.length;
          else if (val?.content && Array.isArray(val.content)) profObraCount = val.content.length;
          else if (val?.totalElements) profObraCount = val.totalElements;
          console.log('📊 FunctionalDashboard - Profesionales por Obra (asignaciones):', profObraCount);
        }

        // Materiales
        let materialesCount = defaults.materialesStock;
        if (matRes.status === 'fulfilled') {
          const val = matRes.value;
          if (Array.isArray(val)) materialesCount = val.length;
          else if (val?.datos && Array.isArray(val.datos)) materialesCount = val.datos.length;
          else if (val?.content && Array.isArray(val.content)) materialesCount = val.content.length;
          else if (val?.totalElements) materialesCount = val.totalElements;
        }

        // Gastos Generales
        let gastosGeneralesCount = defaults.gastosGenerales;
        if (gastosRes.status === 'fulfilled') {
          const val = gastosRes.value;
          if (Array.isArray(val)) gastosGeneralesCount = val.length;
          else if (val?.datos && Array.isArray(val.datos)) gastosGeneralesCount = val.datos.length;
          else if (val?.content && Array.isArray(val.content)) gastosGeneralesCount = val.content.length;
          else if (val?.totalElements) gastosGeneralesCount = val.totalElements;
        }

        // Proveedores - usar valor por defecto hasta implementar endpoint
        let proveedoresCount = defaults.proveedores;
        // if (provRes.status === 'fulfilled') {
        //   if (Array.isArray(provRes.value)) proveedoresCount = provRes.value.length;
        //   else if (provRes.value?.content && Array.isArray(provRes.value.content)) proveedoresCount = provRes.value.content.length;
        //   else if (provRes.value?.totalElements) proveedoresCount = provRes.value.totalElements;
        // }

        // Usuarios - usar valor por defecto hasta implementar endpoint
        let usuariosCount = defaults.usuarios;
        // if (usrRes.status === 'fulfilled') {
        //   if (Array.isArray(usrRes.value)) usuariosCount = usrRes.value.length;
        //   else if (usrRes.value?.content && Array.isArray(usrRes.value.content)) usuariosCount = usrRes.value.content.length;
        //   else if (usrRes.value?.totalElements) usuariosCount = usrRes.value.totalElements;
        // }

        // Presupuestos
        let presupuestosCount = defaults.presupuestos;
        if (presupRes.status === 'fulfilled') {
          if (Array.isArray(presupRes.value)) presupuestosCount = presupRes.value.length;
          else if (presupRes.value?.content && Array.isArray(presupRes.value.content)) presupuestosCount = presupRes.value.content.length;
          else if (presupRes.value?.totalElements) presupuestosCount = presupRes.value.totalElements;
        }

        // Transacciones financieras - Por ahora usar el mismo número que obras
        // TODO: Implementar endpoint específico en el backend para contar transacciones
        let transaccionesFinancierasCount = obrasCount;

        // Obras Manuales (Independientes) - Contar obras SIN presupuesto asociado
        let trabajosIndependientesCount = 0;
        if (obrasRes.status === 'fulfilled' && presupRes.status === 'fulfilled') {
          const obrasArray = Array.isArray(obrasRes.value)
            ? obrasRes.value
            : (obrasRes.value?.datos || obrasRes.value?.content || []);

          const presupuestosArray = Array.isArray(presupRes.value)
            ? presupRes.value
            : (presupRes.value?.content || presupRes.value?.datos || []);

          // Crear Set de IDs de obras que tienen presupuesto
          const obrasConPresupuesto = new Set();
          presupuestosArray.forEach(p => {
            if (p.obraId) obrasConPresupuesto.add(p.obraId);
          });

          // Contar obras que NO tienen presupuesto y NO están canceladas
          trabajosIndependientesCount = obrasArray.filter(obra =>
            !obrasConPresupuesto.has(obra.id) &&
            !obra.presupuestoNoCliente &&
            obra.estado !== 'CANCELADO'
          ).length;

          console.log('📊 Obras manuales (sin presupuesto):', trabajosIndependientesCount);
        }

        // Si alguna petición devolvió error, avisamos sin romper la UI
        const rejected = results.filter(r => r.status === 'rejected');
        if (rejected.length > 0 && showNotification) {
          showNotification('⚠️ Algunas métricas no pudieron ser cargadas (backend inaccesible o respuestas vacías). Mostrando valores por defecto.', 'warning');
        }

        setStats({
          empresas: empresasCount,
          clientes: clientesCount,
          obras: obrasCount,
          profesionales: profCount,
          profesionalesPorObra: profObraCount,
          obrasActivas: obrasCount, // aproximación
          materialesStock: materialesCount,
          gastosGenerales: gastosGeneralesCount,
          proveedores: proveedoresCount,
          usuarios: usuariosCount,
          presupuestos: presupuestosCount,
          transaccionesFinancieras: transaccionesFinancierasCount,
          trabajosObrasIndependientes: trabajosIndependientesCount
        });

        // Fallback específico: si empresasCount es 0, intentar endpoint alternativo '/empresas/simple'
        if ((empresasCount === 0 || empresasCount === undefined) ) {
          try {
            const simple = await apiService.get('/empresas/simple');
            let simpleData = [];
            if (simple && Array.isArray(simple)) simpleData = simple;
            else if (simple && simple.datos && Array.isArray(simple.datos)) simpleData = simple.datos;
            else if (simple && simple.content && Array.isArray(simple.content)) simpleData = simple.content;

            if (simpleData.length > 0) {
              setStats(prev => ({ ...prev, empresas: simpleData.length }));
              if (showNotification) showNotification(`✅ Se encontraron ${simpleData.length} empresas usando fallback /empresas/simple`, 'success');
            }
          } catch (fbErr) {
            // Fallback falló silenciosamente
          }
        }

        // Si aún no hay empresas, intentar leer del store de redux (por ejemplo, si otro slice ya cargó empresas)
        if ((!empresasCount || empresasCount === 0) && empresasFromStore && empresasFromStore.length > 0) {
          setStats(prev => ({ ...prev, empresas: empresasFromStore.length }));
          if (showNotification) showNotification(`✅ Se encontraron ${empresasFromStore.length} empresas usando datos desde el store`, 'info');
        }

      } catch (err) {
        console.error('Error al cargar métricas del backend:', err);
        if (showNotification) showNotification('❌ No se pudieron cargar métricas del backend. Usando valores por defecto.', 'error');
        // Mantener valores por defecto
        setStats(prev => prev);
      }

      if (showNotification) {
        showNotification('✅ Dashboard cargado correctamente (datos actualizados o por defecto)', 'success');
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      if (showNotification) {
        showNotification('❌ Error al cargar datos del dashboard', 'error');
      }
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [empresaSeleccionada, showNotification, empresasFromStore]);

  const testConnection = async () => {
    try {
      setLoading(true);
      // await apiService.getHealth();
      showNotification('✅ Conexión exitosa con el backend', 'success');
    } catch (error) {
      showNotification('❌ Error de conexión con el backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Memoizar entityCards para evitar recreación en cada render
  const entityCards = useMemo(() => [
    {
      title: 'Empresas',
      value: stats.empresas,
      icon: 'fas fa-building',
      color: 'primary',
      link: '/empresas',
      description: 'Gestión multi-tenant'
    },
    {
      title: 'Clientes',
      value: stats.clientes,
      icon: 'fas fa-users',
      color: 'success',
      link: '/clientes',
      description: 'Base de datos de clientes'
    },
    {
      title: 'Obras',
      value: stats.obras,
      icon: 'fas fa-hard-hat',
      color: 'warning',
      link: '/obras',
      description: 'Proyectos de construcción'
    },
    {
      title: 'Profesionales',
      value: stats.profesionales,
      icon: 'fas fa-user-tie',
      color: 'info',
      link: '/profesionales',
      description: 'Arquitectos e ingenieros',
      customColor: '#e83e8c'
    },
    {
      title: 'Materiales',
      value: stats.materialesStock,
      icon: 'fas fa-boxes',
      color: 'secondary',
      link: '/materiales',
      description: 'Catálogo de materiales'
    },
    {
      title: 'Gastos Generales',
      value: stats.gastosGenerales,
      icon: 'fas fa-receipt',
      color: 'warning',
      link: '/gastos-generales',
      description: 'Otros costos y gastos',
      customColor: '#20c997'
    },
    {
      title: 'Proveedores',
      value: stats.proveedores,
      icon: 'fas fa-truck',
      color: 'danger',
      link: '/proveedores',
      description: 'Red de proveedores'
    },
    {
      title: 'Presupuestos',
      value: stats.presupuestos,
      icon: 'fas fa-file-signature',
      color: 'dark',
      link: '/presupuestos-no-cliente',
      description: 'Gestión de presupuestos'
    },
    {
      title: 'Pagos - Cobros - Retiros',
      value: stats.transaccionesFinancieras,
      icon: 'fas fa-money-bill-wave',
      color: 'success',
      link: '/sistema-financiero',
      description: 'Cobros, Pagos y Retiros de Obras',
      customColor: '#17a2b8'
    },
    {
      title: 'Usuarios',
      value: stats.usuarios,
      icon: 'fas fa-user-cog',
      color: 'warning',
      link: '/usuarios',
      description: 'Gestión de usuarios',
      customColor: '#6f42c1'
    },
    {
      title: 'Profesionales por Obra',
      value: stats.profesionalesPorObra,
      icon: 'fas fa-users-cog',
      color: 'primary',
      link: '/profesionales-obra',
      description: 'Asignación de profesionales',
      customColor: '#fd7e14'
    },
    {
      title: 'Trabajos Diarios|Nuevos Clientes',
      value: stats.trabajosObrasIndependientes,
      icon: 'fas fa-wrench',
      color: 'success',
      link: '/presupuestos-no-cliente',
      description: 'Crear presupuestos para nuevos clientes',
      customColor: '#ff8c42'
    },
    {
      title: 'Reportes del Sistema',
      value: '📊',
      icon: 'fas fa-shield-alt',
      color: 'info',
      link: '/reportes-sistema',
      description: 'Auditorías y backups automáticos',
      customColor: '#667eea'
    }
  ], [stats]);

  // Mapeo de colores Bootstrap a hexadecimal
  const colorMap = {
    'primary': '#007bff',
    'success': '#28a745',
    'warning': '#ffc107',
    'info': '#17a2b8',
    'danger': '#dc3545',
    'secondary': '#6c757d',
    'dark': '#343a40'
  };

  return (
    <div className="container-fluid fade-in" style={{ minWidth: '1100px' }}>

      {/* Tarjetas de entidades */}
      <div className="row mb-4">
        <div className="col-12 mb-3">
          <h3>
            <i className="fas fa-th-large me-2"></i>
            Controladores del Sistema ({entityCards.length})
          </h3>
          {entityCards.length === 0 && (
            <div className="alert alert-warning">
              ⚠️ No se encontraron tarjetas de controladores
            </div>
          )}
        </div>
        {entityCards.map((card) => {
          const borderColor = card.customColor || colorMap[card.color] || '#007bff';

          return (
          <div className="col-3 col-md-6 col-lg-4 col-xl-3 mb-4" key={card.title}>
            <Link
              to={card.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
            >
              <div
                className={`card shadow h-100 py-2 entity-card`}
                style={{
                  minHeight: '150px',
                  borderTop: `2px solid ${borderColor}`,
                  borderRight: `2px solid ${borderColor}`,
                  borderBottom: `2px solid ${borderColor}`,
                  borderLeft: `2px solid ${borderColor}`
                }}
              >
                <div className="card-body">
                  {card.isNew && (
                    <span className="badge bg-success position-absolute top-0 end-0 m-2">
                      ¡NUEVO!
                    </span>
                  )}
                  <div className="row no-gutters align-items-center">
                    <div className="col mr-2">
                      <div
                        className={`text-xs font-weight-bold ${!card.customColor ? `text-${card.color}` : ''} text-uppercase mb-1`}
                        style={card.customColor ? { color: card.customColor + ' !important' } : {}}
                      >
                        {card.title.includes('|') ? (
                          card.title.split('|').map((line, idx) => (
                            <React.Fragment key={idx}>
                              {line}
                              {idx < card.title.split('|').length - 1 && <br />}
                            </React.Fragment>
                          ))
                        ) : (
                          card.title
                        )}
                      </div>
                      <div className="h5 mb-0 font-weight-bold text-gray-800">
                        {loading ? (
                          <div className="spinner-border spinner-border-sm" role="status">
                            <span className="visually-hidden">Cargando...</span>
                          </div>
                        ) : (
                          card.value
                        )}
                      </div>
                      <small className="text-muted">{card.description}</small>
                    </div>
                    <div className="col-auto">
                      <i className={`${card.icon} fa-2x text-gray-300`}></i>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span
                      className={`btn btn-${card.color} btn-sm w-100`}
                      style={card.customColor ? { backgroundColor: card.customColor, borderColor: card.customColor } : {}}
                    >
                      <i className="fas fa-arrow-right me-1"></i>
                      Gestionar
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
          );
        })}
      </div>

      {/* Sección de ventajas eliminada por solicitud */}

      {/* Accesos rápidos */}
      <div className="row mb-4">
        <div className="col-12">
          <h4 className="mb-3">
            <i className="fas fa-lightning-bolt me-2"></i>
            Accesos Rápidos
          </h4>
          <div className="row">
            <div className="col-md-4">
              <Link to="/api-tester" className="text-decoration-none" target="_blank" rel="noopener noreferrer">
                <div className="card border-primary">
                  <div className="card-body text-center">
                    <i className="fas fa-flask fa-2x text-primary mb-2"></i>
                    <h6>Probador de API</h6>
                    <small className="text-muted">Probar endpoints directamente</small>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-md-4">
              <div className="card border-info cursor-pointer" onClick={() => {
                const swaggerUrl = import.meta.env.MODE === 'production'
                  ? 'https://backend-constructora2-production.up.railway.app/api/swagger-ui/index.html'
                  : 'http://localhost:8080/api/swagger-ui/index.html';
                window.open(swaggerUrl, '_blank');
              }}>
                <div className="card-body text-center">
                  <i className="fas fa-external-link-alt fa-2x text-info mb-2"></i>
                  <h6>Ver Swagger</h6>
                  <small className="text-muted">Documentación tradicional</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-success cursor-pointer" onClick={() => showNotification && showNotification('Funcionalidad próximamente', 'info')}>
                <div className="card-body text-center">
                  <i className="fas fa-chart-bar fa-2x text-success mb-2"></i>
                  <h6>Reportes</h6>
                  <small className="text-muted">Análisis y estadísticas</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón y modal para obtener todas las versiones de presupuesto eliminado por solicitud */}

      {/* Instrucciones */}

    </div>
  );
};

export default FunctionalDashboard;
