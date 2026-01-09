import React, { useState } from 'react';

const SidebarProfesionalesObrasMenu = ({ onAction }) => {
  const [openSection, setOpenSection] = useState(null);

  const toggle = (key) => {
    // Si la sección ya está abierta, la cierra; si no, cierra todas y abre la nueva
    setOpenSection(openSection === key ? null : key);
  };

  return (
    <div className="sidebar-profesionales-menu p-4" style={{ background: '#0866c6', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '40px' }}>
      {/* Botón principal: Consultas */}
      <div style={{marginBottom: '0px'}}>
        <button className="btn btn-success w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0' }} onClick={() => toggle('consultas')}>
          Consultas {openSection === 'consultas' ? '▲' : '▼'}
        </button>
        {openSection === 'consultas' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('listar-por-tipo')}>Listar profesionales por tipo</button>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('profesionales-por-obra')}>Profesionales por obra</button>
          </div>
        )}
      </div>
      {/* Botón principal: Presupuestos */}
      <div style={{marginBottom: '0px'}}>
        <button className="btn btn-light w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0', color: '#0866c6', border: '2px solid white' }} onClick={() => toggle('presupuestos')}>
          📋 Presupuestos {openSection === 'presupuestos' ? '▲' : '▼'}
        </button>
        {openSection === 'presupuestos' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('listar-presupuestos')}>📋 Ver todos los presupuestos</button>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('historial-versiones')}>📚 Ver historial de versiones</button>
          </div>
        )}
      </div>
      {/* Botón principal: Caja Chica */}
      <div style={{marginBottom: '0px'}}>
        <button className="btn btn-warning w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0' }} onClick={() => toggle('cajaChica')}>
          💰 Caja Chica {openSection === 'cajaChica' ? '▲' : '▼'}
        </button>
        {openSection === 'cajaChica' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('asignar-caja-chica')}>Asignar caja chica</button>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('consultar-saldo')}>Consultar saldo</button>
          </div>
        )}
      </div>
      {/* Botón principal: Gastos */}
      <div style={{marginBottom: '0px'}}>
        <button className="btn btn-danger w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0' }} onClick={() => toggle('gastos')}>
          🛒 Gastos de Obra {openSection === 'gastos' ? '▲' : '▼'}
        </button>
        {openSection === 'gastos' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('registrar-gasto')}>Registrar gasto</button>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('listar-gastos')}>Historial de gastos</button>
          </div>
        )}
      </div>
      {/* Botón principal: Asistencia */}
      <div style={{marginBottom: '0px'}}>
        <button className="btn btn-dark w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0' }} onClick={() => toggle('asistencia')}>
          🕒 Control de Asistencia {openSection === 'asistencia' ? '▲' : '▼'}
        </button>
        {openSection === 'asistencia' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('check-in')}>Check-In (Entrada)</button>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('check-out')}>Check-Out (Salida)</button>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('historial-asistencias')}>Historial de asistencias</button>
          </div>
        )}
      </div>
      {/* Botón principal: Edición */}
      <div style={{marginBottom: '0px'}}>
        <button className="btn btn-info w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0' }} onClick={() => toggle('edicion')}>
          Edición {openSection === 'edicion' ? '▲' : '▼'}
        </button>
        {openSection === 'edicion' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('actualizar-asignacion')}>Actualizar asignación</button>
          </div>
        )}
      </div>
      {/* Botón principal: Desactivar */}
      <div>
        <button className="btn btn-secondary w-100 mb-2" style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '14px 0' }} onClick={() => toggle('desactivar')}>
          Desactivar {openSection === 'desactivar' ? '▲' : '▼'}
        </button>
        {openSection === 'desactivar' && (
          <div style={{marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <button className="btn btn-outline-light btn-sm w-100" onClick={() => onAction('desactivar-asignacion')}>Desactivar asignación</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarProfesionalesObrasMenu;
