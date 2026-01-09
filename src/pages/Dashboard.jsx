import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiService, { getCurrentTenant } from '../services/api';

const Dashboard = ({ showNotification }) => {
  const [stats, setStats] = useState({
    empresas: 0,
    clientes: 0,
    obras: 0,
    profesionales: 0,
    obrasActivas: 0,
    materialesStock: 0,
    pedidosPendientes: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Cargar estadísticas principales
      const [
        empresasData,
        clientesData,
        obrasData,
        profesionalesData,
        materialesData
      ] = await Promise.allSettled([
        apiService.empresas.getAll(),
        apiService.clientes.getAllSimple(getCurrentTenant()),
        apiService.obras.getActivas(getCurrentTenant()),
        apiService.profesionales.getAll(getCurrentTenant()),
        apiService.materiales.getAll(getCurrentTenant())
      ]);

      setStats({
        empresas: empresasData.status === 'fulfilled' ? empresasData.value?.length || 0 : 0,
        clientes: clientesData.status === 'fulfilled' ? clientesData.value?.length || 0 : 0,
        obras: obrasData.status === 'fulfilled' ? obrasData.value?.length || 0 : 0,
        profesionales: profesionalesData.status === 'fulfilled' ? profesionalesData.value?.length || 0 : 0,
        obrasActivas: obrasData.status === 'fulfilled' ? obrasData.value?.filter(o => o.estado === 'EN OBRA')?.length || 0 : 0,
        materialesStock: materialesData.status === 'fulfilled' ? materialesData.value?.length || 0 : 0,
        pedidosPendientes: 0 // Se puede agregar más tarde
      });

      // Actividad reciente simulada (podrías implementar endpoints específicos)
      setRecentActivity([
        { id: 1, tipo: 'obra', mensaje: 'Nueva obra creada: Casa Familiar García', tiempo: '2 horas' },
        { id: 2, tipo: 'profesional', mensaje: 'Profesional asignado a obra', tiempo: '4 horas' },
        { id: 3, tipo: 'material', mensaje: 'Stock bajo en Cemento Portland', tiempo: '6 horas' },
        { id: 4, tipo: 'costo', mensaje: 'Nuevo costo aprobado: $150,000', tiempo: '1 día' },
      ]);

      if (showNotification) {
        showNotification('✅ Dashboard actualizado correctamente', 'success');
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
      if (showNotification) {
        showNotification('❌ Error al cargar datos del dashboard', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      await apiService.getHealth();
      showNotification('✅ Conexión exitosa con el backend', 'success');
    } catch (error) {
      showNotification('❌ Error de conexión con el backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: 'Empresas',
      value: stats.empresas,
      icon: 'fas fa-building',
      color: 'primary',
      link: '/empresas'
    },
    {
      title: 'Clientes',
      value: stats.clientes,
      icon: 'fas fa-users',
      color: 'success',
      link: '/clientes'
    },
    {
      title: 'Obras',
      value: stats.obras,
      icon: 'fas fa-hard-hat',
      color: 'warning',
      link: '/obras'
    },
    {
      title: 'Profesionales',
      value: stats.profesionales,
      icon: 'fas fa-user-tie',
      color: 'info',
      link: '/profesionales'
    },
    {
      title: 'Materiales',
      value: stats.materialesStock || 'N/A',
      icon: 'fas fa-boxes',
      color: 'secondary',
      link: '/materiales'
    },
    {
      title: 'Proveedores',
      value: stats.pedidosPendientes || 'N/A',
      icon: 'fas fa-truck',
      color: 'primary',
      link: '/proveedores'
    },
    {
      title: 'Obras Activas',
      value: stats.obrasActivas,
      icon: 'fas fa-play-circle',
      color: 'success',
      link: '/obras'
    },
    {
      title: 'Pedidos Pendientes',
      value: stats.pedidosPendientes || 'N/A',
      icon: 'fas fa-clock',
      color: 'warning',
      link: '/pedidos-pago'
    }
  ];

  return (

  <div style={{padding: '32px 0 0 0', width: '100%'}}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">
          <i className="fas fa-tachometer-alt me-2"></i>
          Dashboard
        </h1>
        <div>
          <button 
            className="btn btn-outline-primary me-2"
            onClick={loadStats}
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''} me-1`}></i>
            Actualizar
          </button>
          <button 
            className="btn btn-success"
            onClick={testConnection}
            disabled={loading}
          >
            <i className="fas fa-plug me-1"></i>
            Probar Conexión
          </button>
        </div>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <div className="dashboard-grid mb-4">
        {statsCards.map((card) => (
          <div className="dashboard-card" key={card.title}>
            <div className={`card border-left-${card.color} shadow h-100 py-2`}>
              <div className="card-body">
                <div className="row no-gutters align-items-center">
                  <div className="col mr-2">
                    <div className={`text-xs font-weight-bold text-${card.color} text-uppercase mb-1`}>
                      {card.title}
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
                  </div>
                  <div className="col-auto">
                    <i className={`${card.icon} fa-2x text-gray-300`}></i>
                  </div>
                </div>
                <div className="mt-2">
                  <a 
                    href={card.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`btn btn-${card.color} btn-sm`}
                  >
                    <i className="fas fa-arrow-right me-1"></i>
                    Gestionar
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

        {/* Sección de Controladores Completos de la API */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card shadow">
              <div className="card-header py-3 bg-gradient-primary text-white">
                <h6 className="m-0 font-weight-bold">
                  <i className="fas fa-cogs me-2"></i>
                  Todos los Controladores de la API - Sistema Multi-Tenant
                </h6>
                <small className="text-white-75">18 controladores disponibles con endpoints completos</small>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Controladores de la API */}
        <div className="row mb-4">
          
          {/* Empresas */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-primary shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-primary">
                  <i className="fas fa-building me-2"></i>Empresas (Multi-Tenant)
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /empresas/simple - Lista empresas</li>
                  <li><span className="badge bg-success me-1">GET</span> /empresas/buscar - Búsqueda universal</li>
                  <li><span className="badge bg-success me-1">GET</span> /empresas/activas - Solo activas</li>
                  <li><span className="badge bg-warning me-1">POST</span> /empresas - Crear empresa</li>
                  <li><span className="badge bg-info me-1">PUT</span> /empresas/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-danger me-1">DELETE</span> /empresas/{'{id}'} - Eliminar</li>
                </ul>
                <a href="/empresas" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Empresas
                </a>
              </div>
            </div>
          </div>

          {/* Clientes */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-success shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-success">
                  <i className="fas fa-users me-2"></i>Clientes
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /clientes - Lista paginada</li>
                  <li><span className="badge bg-success me-1">GET</span> /clientes/todos - Todos sin paginación</li>
                  <li><span className="badge bg-success me-1">GET</span> /clientes/buscar - Búsqueda por ID/CUIT</li>
                  <li><span className="badge bg-warning me-1">POST</span> /clientes - Crear cliente</li>
                  <li><span className="badge bg-info me-1">PUT</span> /clientes/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-danger me-1">DELETE</span> /clientes/{'{id}'} - Eliminar</li>
                </ul>
                <a href="/clientes" target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Clientes
                </a>
              </div>
            </div>
          </div>

          {/* Obras */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-info shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-info">
                  <i className="fas fa-hammer me-2"></i>Obras
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /obras/todas - Todas las obras</li>
                  <li><span className="badge bg-success me-1">GET</span> /obras/activas - Solo activas</li>
                  <li><span className="badge bg-success me-1">GET</span> /obras/estado/{'{estado}'} - Por estado</li>
                  <li><span className="badge bg-warning me-1">POST</span> /obras - Crear obra</li>
                  <li><span className="badge bg-info me-1">PUT</span> /obras/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-secondary me-1">PATCH</span> /obras/{'{id}'}/estado - Cambiar estado</li>
                </ul>
                <a href="/obras" target="_blank" rel="noopener noreferrer" className="btn btn-info btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Obras
                </a>
              </div>
            </div>
          </div>

          {/* Profesionales */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-warning shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-warning">
                  <i className="fas fa-hard-hat me-2"></i>Profesionales
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /profesionales - Todos</li>
                  <li><span className="badge bg-success me-1">GET</span> /profesionales/por-tipo - Por especialidad</li>
                  <li><span className="badge bg-success me-1">GET</span> /profesionales/tipos-disponibles - Tipos</li>
                  <li><span className="badge bg-warning me-1">POST</span> /profesionales - Crear</li>
                  <li><span className="badge bg-info me-1">PUT</span> /profesionales/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-danger me-1">DELETE</span> /profesionales/{'{id}'} - Eliminar</li>
                </ul>
                <a href="/profesionales" target="_blank" rel="noopener noreferrer" className="btn btn-warning btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Profesionales
                </a>
              </div>
            </div>
          </div>

          {/* Usuarios */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-danger shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-danger">
                  <i className="fas fa-user-shield me-2"></i>Usuarios
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /usuarios - Lista paginada</li>
                  <li><span className="badge bg-success me-1">GET</span> /usuarios/activos - Solo activos</li>
                  <li><span className="badge bg-success me-1">GET</span> /usuarios/rol/{'{rol}'} - Por rol</li>
                  <li><span className="badge bg-warning me-1">POST</span> /usuarios - Crear usuario</li>
                  <li><span className="badge bg-info me-1">PUT</span> /usuarios/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-info me-1">PUT</span> /usuarios/{'{id}'}/password - Cambiar contraseña</li>
                </ul>
                <a href="/usuarios" target="_blank" rel="noopener noreferrer" className="btn btn-danger btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Usuarios
                </a>
              </div>
            </div>
          </div>

          {/* Proveedores */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-dark shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-dark">
                  <i className="fas fa-truck me-2"></i>Proveedores
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /proveedores - Lista paginada</li>
                  <li><span className="badge bg-success me-1">GET</span> /proveedores/activos - Solo activos</li>
                  <li><span className="badge bg-success me-1">GET</span> /proveedores/buscar - Búsqueda</li>
                  <li><span className="badge bg-warning me-1">POST</span> /proveedores - Crear</li>
                  <li><span className="badge bg-info me-1">PUT</span> /proveedores/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-secondary me-1">PATCH</span> /proveedores/{'{id}'}/estado - Estado</li>
                </ul>
                <a href="/proveedores" target="_blank" rel="noopener noreferrer" className="btn btn-dark btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Proveedores
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Segunda fila de controladores */}
        <div className="row mb-4">

          {/* Materiales */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-secondary shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-secondary">
                  <i className="fas fa-boxes me-2"></i>Materiales
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /materiales - Todos activos</li>
                  <li><span className="badge bg-success me-1">GET</span> /materiales/buscar - Búsqueda texto</li>
                  <li><span className="badge bg-success me-1">GET</span> /materiales/precio - Por rango precio</li>
                  <li><span className="badge bg-warning me-1">POST</span> /materiales - Crear</li>
                  <li><span className="badge bg-info me-1">PUT</span> /materiales/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-danger me-1">DELETE</span> /materiales/{'{id}'} - Desactivar</li>
                </ul>
                <a href="/materiales" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Materiales
                </a>
              </div>
            </div>
          </div>

          {/* Presupuestos */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-info shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-info">
                  <i className="fas fa-calculator me-2"></i>Presupuestos
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /presupuestos/empresa - Por empresa</li>
                  <li><span className="badge bg-success me-1">GET</span> /presupuestos/por-estado - Por estado</li>
                  <li><span className="badge bg-success me-1">GET</span> /presupuestos/profesionales-sugeridos - Sugerencias</li>
                  <li><span className="badge bg-warning me-1">POST</span> /presupuestos - Crear</li>
                  <li><span className="badge bg-info me-1">PUT</span> /presupuestos/nueva-version - Nueva versión</li>
                  <li><span className="badge bg-info me-1">PUT</span> /presupuestos/aprobar - Aprobar</li>
                </ul>
                <a href="/presupuestos" target="_blank" rel="noopener noreferrer" className="btn btn-info btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Presupuestos
                </a>
              </div>
            </div>
          </div>

          {/* Profesionales-Obras */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-warning shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-warning">
                  <i className="fas fa-user-hard-hat me-2"></i>Profesionales-Obras
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /profesionales-obras - Lista asignaciones</li>
                  <li><span className="badge bg-success me-1">GET</span> /profesionales-obras/tipo/{'{tipo}'} - Por tipo</li>
                  <li><span className="badge bg-success me-1">GET</span> /profesionales-obras/disponibilidad/{'{tipo}'} - Disponibilidad</li>
                  <li><span className="badge bg-warning me-1">POST</span> /profesionales-obras/asignar - Asignar</li>
                  <li><span className="badge bg-info me-1">PUT</span> /profesionales-obras/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-danger me-1">DELETE</span> /profesionales-obras/{'{id}'} - Desactivar</li>
                </ul>
                <a href="/profesionales-obras" target="_blank" rel="noopener noreferrer" className="btn btn-warning btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Asignaciones
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Tercera fila de controladores */}
        <div className="row mb-4">

          {/* Presupuestos No Cliente */}
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-left-warning shadow h-100">
              <div className="card-header">
                <h6 className="m-0 font-weight-bold text-warning">
                  <i className="fas fa-calculator me-2"></i>Presupuestos No Cliente
                </h6>
              </div>
              <div className="card-body">
                <div className="small text-muted mb-2">Endpoints disponibles:</div>
                <ul className="list-unstyled small">
                  <li><span className="badge bg-success me-1">GET</span> /presupuestos-no-cliente - Lista todos</li>
                  <li><span className="badge bg-success me-1">GET</span> /presupuestos-no-cliente/{'{id}'} - Por ID</li>
                  <li><span className="badge bg-warning me-1">POST</span> /presupuestos-no-cliente - Crear</li>
                  <li><span className="badge bg-info me-1">PUT</span> /presupuestos-no-cliente/{'{id}'} - Actualizar</li>
                  <li><span className="badge bg-danger me-1">DELETE</span> /presupuestos-no-cliente/{'{id}'} - Eliminar</li>
                </ul>
                <a href="/presupuestos-no-cliente" target="_blank" rel="noopener noreferrer" className="btn btn-warning btn-sm w-100">
                  <i className="fas fa-arrow-right me-1"></i>Gestionar Presupuestos
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Acciones rápidas mejoradas */}
        <div className="row">
          <div className="col-lg-6 mb-4">
            <div className="card shadow">
              <div className="card-header py-3 bg-gradient-primary text-white">
                <h6 className="m-0 font-weight-bold">
                  <i className="fas fa-bolt me-2"></i>
                  Acciones Rápidas del Sistema
                </h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6 mb-2">
                    <a href="/empresas" target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm w-100">
                      <i className="fas fa-building me-1"></i>
                      Nueva Empresa
                    </a>
                  </div>
                  <div className="col-md-6 mb-2">
                    <a href="/clientes" target="_blank" rel="noopener noreferrer" className="btn btn-outline-success btn-sm w-100">
                      <i className="fas fa-user-plus me-1"></i>
                      Nuevo Cliente
                    </a>
                  </div>
                  <div className="col-md-6 mb-2">
                    <a href="/obras" target="_blank" rel="noopener noreferrer" className="btn btn-outline-info btn-sm w-100">
                      <i className="fas fa-hammer me-1"></i>
                      Nueva Obra
                    </a>
                  </div>
                  <div className="col-md-6 mb-2">
                    <a href="/profesionales" target="_blank" rel="noopener noreferrer" className="btn btn-outline-warning btn-sm w-100">
                      <i className="fas fa-hard-hat me-1"></i>
                      Nuevo Profesional
                    </a>
                  </div>
                  <div className="col-md-6 mb-2">
                    <a href="/presupuestos" target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary btn-sm w-100">
                      <i className="fas fa-calculator me-1"></i>
                      Nuevo Presupuesto
                    </a>
                  </div>
                  <div className="col-md-6 mb-2">
                    <a href="/materiales" target="_blank" rel="noopener noreferrer" className="btn btn-outline-dark btn-sm w-100">
                      <i className="fas fa-boxes me-1"></i>
                      Nuevo Material
                    </a>
                  </div>
                </div>
                <hr />
                <div className="text-center">
                  <a href="/api-tester" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    <i className="fas fa-flask me-2"></i>
                    Probador de API - ¡Más rápido que Swagger!
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-lg-6 mb-4">
            <div className="card shadow">
              <div className="card-header py-3 bg-gradient-success text-white">
                <h6 className="m-0 font-weight-bold">
                  <i className="fas fa-rocket me-2"></i>
                  Ventajas sobre Swagger UI
                </h6>
              </div>
              <div className="card-body">
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Acceso directo:</strong> Sin navegar por documentación extensa
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Interfaz intuitiva:</strong> Diseñada para máxima productividad
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>CRUD visual:</strong> Crear, editar, eliminar con formularios
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Respuestas claras:</strong> Mejor visualización de datos JSON
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Multi-tenant:</strong> Manejo automático de empresas/tenants
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>18 controladores:</strong> Todos los endpoints organizados
                  </li>
                </ul>

                <div className="text-center mt-3">
                  <small className="text-muted">
                    <i className="fas fa-info-circle me-1"></i>
                    Sistema completo de gestión multi-tenant para construcción
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Información adicional del sistema */}
        <div className="row">
          <div className="col-12">
            <div className="card shadow">
              <div className="card-header py-3 bg-gradient-dark text-white">
                <h6 className="m-0 font-weight-bold">
                  <i className="fas fa-info-circle me-2"></i>
                  Información del Sistema Multi-Tenant
                </h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4">
                    <h6 className="text-primary">
                      <i className="fas fa-database me-1"></i>
                      Base de Datos
                    </h6>
                    <ul className="small text-muted">
                      <li>Sistema multi-tenant completo</li>
                      <li>Separación de datos por empresa</li>
                      <li>Header X-Tenant-ID requerido</li>
                      <li>Autenticación JWT integrada</li>
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <h6 className="text-success">
                      <i className="fas fa-cogs me-1"></i>
                      Funcionalidades
                    </h6>
                    <ul className="small text-muted">
                      <li>Gestión completa de construcción</li>
                      <li>Control de costos y presupuestos</li>
                      <li>Asignación de profesionales</li>
                      <li>Inventario de materiales</li>
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <h6 className="text-info">
                      <i className="fas fa-chart-line me-1"></i>
                      Reportes y Análisis
                    </h6>
                    <ul className="small text-muted">
                      <li>Estadísticas por empresa</li>
                      <li>Análisis de rentabilidad</li>
                      <li>Reportes de costos por obra</li>
                      <li>Seguimiento de jornales</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default Dashboard;
