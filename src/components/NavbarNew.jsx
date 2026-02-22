import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useEmpresa } from '../EmpresaContext';
// SimpleTenantSelector eliminado del navbar para mejorar el layout

const Navbar = ({ onToggleSidebar, collapsed, showNotification }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { empresaSeleccionada, setEmpresaSeleccionada } = useEmpresa();
  const [navbarCollapsed, setNavbarCollapsed] = useState(false);

  const handleCambiarContratista = () => {
    if (confirm('¿Deseas cambiar de contratista? Esto recargará la página.')) {
      setEmpresaSeleccionada(null);
      window.location.href = '/';
    }
  };

  const quickLinks = [
    { path: '/', icon: 'fas fa-chart-line', label: 'Dashboard' },
    { path: '/empresas', icon: 'fas fa-building', label: 'Empresas' },
    { path: '/clientes', icon: 'fas fa-users', label: 'Clientes' },
    { path: '/obras', icon: 'fas fa-hard-hat', label: 'Obras' },
    { path: '/profesionales', icon: 'fas fa-user-tie', label: 'Profesionales' },
    { path: '/profesionales-obra', icon: 'fas fa-users-cog', label: 'Profesionales por Obra' },
    { path: '/materiales', icon: 'fas fa-boxes', label: 'Materiales' },
    { path: '/gastos-generales', icon: 'fas fa-receipt', label: 'Gastos Generales' },
    { path: '/sistema-financiero', icon: 'fas fa-money-bill-wave', label: 'Pagos - Cobros - Retiros' },
    { path: '/reportes-sistema', icon: 'fas fa-shield-alt', label: 'Reportes del Sistema' },
    { path: '/proveedores', icon: 'fas fa-truck', label: 'Proveedores' },
    { path: '/stock', icon: 'fas fa-warehouse', label: 'Stock' },
    { path: '/presupuestos-no-cliente', icon: 'fas fa-file-signature', label: 'Presupuestos' },
    { path: '/usuarios', icon: 'fas fa-user-cog', label: 'Usuarios' },
  ];

  const openInNewTab = (path) => {
    window.open(window.location.origin + path, '_blank');
  };

  const buttonBaseStyle = {
    minWidth: 110,
    padding: '4px 8px',
    fontSize: '0.72rem',
    borderColor: isHome ? '#ff4500' : '#06203a',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    color: '#fff',
  };
  const bigBorderStyle = { borderColor: isHome ? '#ff4500' : '#06203a', borderWidth: '4px', borderStyle: 'solid' };
  const lightBlueBg = { backgroundColor: '#66ccff', color: '#000', fontWeight: 700 }; // celeste más fuerte y texto en negrita
  const actionButtonStyle = {
    ...bigBorderStyle,
    ...lightBlueBg,
    minWidth: 140,
    height: 57, // incrementado 50% desde 38
    padding: '8px 14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const makePersistBlack = (el) => {
    if (!el) return;
    el.style.color = '#000';
  };

  return (
    <>
      {/* Botón flotante para mostrar/ocultar navbar */}
      <button
        onClick={() => setNavbarCollapsed(!navbarCollapsed)}
        style={{
          position: 'fixed',
          top: navbarCollapsed ? '5px' : '105px',
          right: '5px',
          zIndex: 11000,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#28a745',
          color: 'white',
          border: '1px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          transition: 'all 0.3s ease',
        }}
        title={navbarCollapsed ? "Mostrar navbar" : "Ocultar navbar"}
      >
        <i className={`fas ${navbarCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
      </button>

      <nav
        className="navbar navbar-expand-lg navbar-dark bg-primary sticky-top"
        style={{
          transform: navbarCollapsed ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div className="container-fluid">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <i className="fas fa-hard-hat me-2"></i>
            <div className="d-flex flex-column">
              {empresaSeleccionada && (
                <>
                  <span className="text-warning fw-bold fs-4">
                    {empresaSeleccionada.nombreEmpresa}
                  </span>
                  <button
                    onClick={handleCambiarContratista}
                    className="btn btn-sm btn-outline-warning mt-1"
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    title="Cambiar de contratista"
                  >
                    <i className="fas fa-exchange-alt me-1"></i>Cambiar
                  </button>
                </>
              )}
            </div>
          </Link>

        {!isHome && (
          <>
            <Link
              className="btn btn-light btn-sm"
              to="/"
              style={{ ...actionButtonStyle, marginLeft: '120px' }}
              onMouseEnter={(e) => makePersistBlack(e.currentTarget)}
            >
              <i className="fas fa-arrow-left me-1"></i>
              Volver al inicio
            </Link>

            <div className="d-none d-md-flex" style={{ flexWrap: 'wrap', maxWidth: 760, gap: 6, marginLeft: '120px' }}>
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-light btn-sm"
                  title={link.label}
                  style={buttonBaseStyle}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}
                >
                  <i className={`${link.icon} me-1`}></i>
                  <span className="d-none d-md-inline">{link.label}</span>
                </Link>
              ))}
            </div>

            <div className="dropdown ms-3 d-inline d-md-none">
                <button
                className="btn btn-outline-light btn-sm dropdown-toggle"
                type="button"
                id="quickLinksDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                  style={{ borderColor: isHome ? undefined : '#06203a' }}
              >
                <i className="fas fa-th-list"></i>
              </button>
              <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="quickLinksDropdown">
                {quickLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                    >
                      <i className={`${link.icon} me-2`}></i>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="d-flex align-items-center ms-auto">
          {/* SimpleTenantSelector removido para reducir espacio en el navbar */}

            {!isHome && (
            <div className="ms-2">
              <button
                className="btn btn-light btn-sm ms-2"
                title="Cerrar esta página"
                onClick={() => {
                  try {
                    window.close();
                    setTimeout(() => {
                      if (!window.closed) {
                        window.location.href = '/';
                        if (typeof showNotification === 'function')
                          showNotification('No se pudo cerrar la pestaña; redirigiendo al inicio.', 'info');
                      }
                    }, 300);
                  } catch (e) {
                    window.location.href = '/';
                  }
                }}
                style={actionButtonStyle}
                onMouseEnter={(e) => makePersistBlack(e.currentTarget)}
              >
                <i className="fas fa-times me-1"></i>
                Cerrar esta Ventana
              </button>
            </div>
          )}

          {isHome && (
            <div className="ms-3">
              <button
                className="btn btn-danger btn-sm"
                title="Cerrar aplicación"
                onClick={() => {
                  if (window.confirm('¿Está seguro que desea cerrar la aplicación?')) {
                    window.close();
                    // Si no se puede cerrar (en algunos navegadores), redirigir a about:blank
                    setTimeout(() => {
                      if (!window.closed) {
                        window.location.href = 'about:blank';
                      }
                    }, 300);
                  }
                }}
                style={{
                  minWidth: 100,
                  height: 40,
                  fontWeight: 'bold',
                }}
              >
                <i className="fas fa-power-off me-2"></i>
                Salir
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
};

export default Navbar;
