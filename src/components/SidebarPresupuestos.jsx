import React from 'react';
import './SidebarPresupuestos.css';

const SidebarPresupuestos = ({ children, collapsed, onToggleSidebar }) => (
  <>
    <aside
      className={`sidebar-presupuestos${collapsed ? ' collapsed' : ''}`}
      style={{
        top: 56,
        left: collapsed ? '-260px' : '0',
        zIndex: 1040,
        minHeight: 'calc(100vh - 56px)',
        position: 'fixed',
        transition: 'left 0.3s',
      }}
    >
      <div className="d-flex align-items-center justify-content-between" style={{ padding: '24px 24px 12px 24px', borderBottom: '1px solid #eee' }}>
        <h4 className="sidebar-title mb-0" style={{ fontWeight: 700, fontSize: '1.25rem' }}>Acciones</h4>
        <button
          className="sidebar-btn btn btn-sm ms-2"
          style={{ borderRadius: '50%', width: 32, height: 32 }}
          title={collapsed ? 'Abrir menú' : 'Cerrar menú'}
          onClick={onToggleSidebar}
        >
          <i className={`fas fa-${collapsed ? 'chevron-right' : 'chevron-left'}`}></i>
        </button>
      </div>
      <div className="sidebar-content px-3 pt-3">
        {children}
      </div>
    </aside>
  </>
);

export default SidebarPresupuestos;
