import React from 'react';
import { Link } from 'react-router-dom';
import TenantSelector from './TenantSelector';

const Navbar = ({ onToggleSidebar, collapsed, showNotification }) => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
      <div className="container-fluid">
        <button 
          className="btn btn-outline-light me-3"
          onClick={onToggleSidebar}
          type="button"
        >
          <i className={`fas fa-${collapsed ? 'bars' : 'times'}`}></i>
        </button>
        
        <Link className="navbar-brand" to="/">
          <i className="fas fa-hard-hat me-2"></i>
          Sistema de Construcción
          <span className="badge bg-success ms-2">Más rápido que Swagger</span>
        </Link>

        <div className="d-flex align-items-center ms-auto">
          {/* Selector de Tenant */}
          <TenantSelector showNotification={showNotification} />
          
          {/* Menú de configuración */}
          <div className="nav-item dropdown ms-3">
            <a 
              className="nav-link dropdown-toggle text-light" 
              href="#" 
              role="button" 
              data-bs-toggle="dropdown"
            >
              <i className="fas fa-cog me-1"></i>
              Configuración
            </a>
            <ul className="dropdown-menu">
              <li>
                <a className="dropdown-item" href="#">
                  <i className="fas fa-server me-2"></i>
                  Backend: {import.meta.env.MODE === 'production' ? 'Railway Cloud' : 'localhost:8080'}
                </a>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <Link className="dropdown-item" to="/api-tester">
                  <i className="fas fa-flask me-2"></i>
                  Probador de API
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;