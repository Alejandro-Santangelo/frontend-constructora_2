import React, { useState } from 'react';
import './SidebarPresupuestos.css';

const menuConfig = [
  {
    key: 'crear',
    label: 'Crear Presupuesto',
    icon: 'fas fa-plus',
    color: 'primary',
    children: [
      { label: 'Nuevo presupuesto', onClick: 'crear' },
      { label: 'Duplicar presupuesto', onClick: 'duplicar' },
    ]
  },
  {
    key: 'enviar',
    label: 'Enviar/Compartir',
    icon: 'fas fa-paper-plane',
    color: 'success',
    children: [
      { label: '📤 Enviar presupuesto', onClick: 'enviarPresupuesto' },
      { label: '📧 Compartir por email', onClick: 'compartirEmail' },
      { label: '💬 Compartir por WhatsApp', onClick: 'compartirWhatsApp' },
    ]
  },
  {
    key: 'consultas',
    label: 'Consultas',
    icon: 'fas fa-search',
    color: 'info',
    children: [
      { label: '👁️ Ver presupuesto seleccionado', onClick: 'verPresupuestoSeleccionado' },
      { label: 'Filtrar por estado', onClick: 'filtrar' },
      { label: 'Listar por empresa y estado', onClick: 'listarPorEmpresaEstado' },
      { label: 'Listar todos los presupuestos', onClick: 'listarTodos' },
      { label: 'Búsqueda específica de presupuestos', onClick: 'buscarPorDireccion' },
      { label: 'Buscar por tipo de profesional', onClick: 'buscarPorTipoProfesional' },
      { label: 'Ver profesionales sugeridos', onClick: 'sugeridos' },
      { label: 'Ver profesionales asignados', onClick: 'asignados' },
      { label: 'Obtener presupuesto por obra y versión', onClick: 'obraVersion' },
      { label: 'Obtener todas las versiones', onClick: 'versiones' },
      { label: '📚 Ver historial de versiones', onClick: 'historialVersiones' },
    ]
  },
  {
    key: 'modificaciones',
    label: 'Modificaciones',
    icon: 'fas fa-edit',
    color: 'warning',
    children: [
      { label: '✏️ Editar presupuesto', onClick: 'editar' },
      { label: '📅 Modificar fechas', onClick: 'editarSoloFechas' },
      { label: 'Asignar profesionales', onClick: 'asignar' },
      { label: 'Crear nueva versión', onClick: 'nuevaVersion' },
      { label: 'Modificar estado', onClick: 'modificarEstado' },
      { label: 'Aprobar presupuesto', onClick: 'aprobar' },
    ]
  },
  {
    key: 'eliminar',
    label: 'Eliminar',
    icon: 'fas fa-trash',
    color: 'danger',
    children: [
      { label: 'Eliminar presupuesto', onClick: 'eliminar' },
      { label: 'Buscar para eliminar', onClick: 'buscarParaEliminar' },
    ]
  }
];

const SidebarPresupuestosMenu = ({ onAction }) => {
  const [openMenu, setOpenMenu] = useState(null);

  return (
    <div className="sidebar-menu-group">
      {menuConfig.map((menu) => (
        <div key={menu.key} className="mb-3">
          <button
            className={`sidebar-btn w-100 d-flex align-items-center py-3 fs-5 fw-bold sidebar-btn-${menu.color}`}
            style={{ fontSize: '1.1rem', justifyContent: 'flex-start' }}
            onClick={() => setOpenMenu(openMenu === menu.key ? null : menu.key)}
          >
            <i className={`${menu.icon} me-3`}></i>
            {menu.label}
            <i className={`fas fa-chevron-${openMenu === menu.key ? 'up' : 'down'} ms-auto`}></i>
          </button>
          {openMenu === menu.key && (
            <div className="sidebar-submenu fade-in">
              {menu.children.map((child, idx) => (
                <button
                  key={child.label}
                  className={`sidebar-btn sidebar-btn-${menu.color} w-100 text-start py-2`}
                  style={{ fontSize: '1rem', marginBottom: 6 }}
                  onClick={() => onAction && onAction(child.onClick)}
                >
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SidebarPresupuestosMenu;
