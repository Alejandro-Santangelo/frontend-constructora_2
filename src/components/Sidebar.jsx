import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tieneAccesoASeccion } from '../services/permisosService';

const Sidebar = ({ collapsed, onToggleSidebar }) => {
  const location = useLocation();

  const menuItems = [
    {
      path: '/',
      icon: 'fas fa-chart-line',
      label: 'Dashboard',
      description: 'Vista general del sistema',
      seccion: 'dashboard' // Siempre visible
    },
    {
      path: '/empresas',
      icon: 'fas fa-building',
      label: 'Empresas',
      description: 'Gestión de tenants',
      badge: 'MULTI-TENANT',
      seccion: 'empresas'
    },
    {
      path: '/clientes',
      icon: 'fas fa-users',
      label: 'Clientes',
      description: 'Gestión de clientes',
      seccion: 'clientes'
    },
    {
      path: '/obras',
      icon: 'fas fa-hard-hat',
      label: 'Obras',
      description: 'Proyectos de construcción',
      seccion: 'obras'
    },
    {
      path: '/profesionales',
      icon: 'fas fa-user-tie',
      label: 'Profesionales',
      description: 'Arquitectos, ingenieros, etc.',
      seccion: 'profesionales'
    },
    {
      path: '/materiales',
      icon: 'fas fa-boxes',
      label: 'Materiales',
      description: 'Catálogo de materiales',
      seccion: 'materiales'
    },
    {
      path: '/proveedores',
      icon: 'fas fa-truck',
      label: 'Proveedores',
      description: 'Gestión de proveedores',
      seccion: 'proveedores'
    },
    {
      path: '/stock',
      icon: 'fas fa-warehouse',
      label: 'Stock',
      description: 'Control de inventario',
      seccion: 'materiales' // Mismo permiso que materiales
    },
    {
      path: '/presupuestos',
      icon: 'fas fa-file-alt',
      label: 'Presupuestos',
      description: 'Cotizaciones y presupuestos',
      seccion: 'presupuestos'
    },
    {
      path: '/api-tester',
      icon: 'fas fa-flask',
      label: 'API Tester',
      description: 'Pruebas de endpoints',
      badge: 'RÁPIDO',
      seccion: 'dashboard' // Siempre visible para debug
    }
  ];

  // 🔐 Filtrar menú según permisos del usuario
  const menuItemsPermitidos = useMemo(() => {
    return menuItems.filter(item => {
      // Dashboard siempre visible
      if (item.seccion === 'dashboard') return true;
      // Verificar permiso para otras secciones
      return tieneAccesoASeccion(item.seccion);
    });
  }, []);

  if (collapsed) {
    return (
      <nav className="col-md-1 d-md-block bg-light sidebar collapse">
        <div className="position-sticky pt-3">
          <div className="d-flex justify-content-end align-items-center px-2 pt-2">
            <button
              className="btn btn-sm btn-light"
              style={{ borderRadius: '50%', width: 32, height: 32 }}
              title={collapsed ? 'Abrir menú' : 'Cerrar menú'}
              onClick={onToggleSidebar}
            >
              <i className={`fas fa-${collapsed ? 'chevron-right' : 'chevron-left'}`}></i>
            </button>
          </div>
          <ul className="nav flex-column">
            {menuItemsPermitidos.map((item) => (
              <li className="nav-item mb-2" key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link text-center ${
                    location.pathname === item.path ? 'active bg-primary text-white' : 'text-dark'
                  }`}
                  title={item.label}
                >
                  <i className={`${item.icon} fa-lg`}></i>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    );
  }

  return (
    <nav className="col-md-3 col-lg-2 d-md-block bg-light sidebar collapse">
      <div className="position-sticky pt-3">
        <div className="d-flex justify-content-end align-items-center px-2 pt-2">
          <button
            className="btn btn-sm btn-light"
            style={{ borderRadius: '50%', width: 32, height: 32 }}
            title={collapsed ? 'Abrir menú' : 'Cerrar menú'}
            onClick={onToggleSidebar}
          >
            <i className={`fas fa-${collapsed ? 'chevron-right' : 'chevron-left'}`}></i>
          </button>
        </div>
        <h6 className="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted">
          <span>NAVEGACIÓN</span>
        </h6>
        
        <ul className="nav flex-column">
          {menuItemsPermitidos.map((item) => (
            <li className="nav-item" key={item.path}>
              <Link
                to={item.path}
                className={`nav-link ${
                  location.pathname === item.path ? 'active bg-primary text-white' : 'text-dark'
                }`}
              >
                <i className={`${item.icon} me-2`}></i>
                {item.label}
                {item.badge && (
                  <span className="badge bg-success ms-2 small">{item.badge}</span>
                )}
              </Link>
              {!collapsed && (
                <small className="text-muted ms-4 d-block mb-2">
                  {item.description}
                </small>
              )}
            </li>
          ))}
        </ul>
        
        <h6 className="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted">
          <span>VENTAJAS</span>
        </h6>
        
        <div className="px-3">
          <div className="card border-success mb-2">
            <div className="card-body p-2">
              <h6 className="card-title text-success mb-1">
                <i className="fas fa-bolt me-1"></i>
                Más Rápido
              </h6>
              <small className="text-muted">
                Sin navegar por Swagger, acceso directo a endpoints
              </small>
            </div>
          </div>
          
          <div className="card border-info mb-2">
            <div className="card-body p-2">
              <h6 className="card-title text-info mb-1">
                <i className="fas fa-mouse-pointer me-1"></i>
                Más Intuitivo
              </h6>
              <small className="text-muted">
                Interfaz diseñada para productividad
              </small>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;