
import React, { useState } from 'react';

const SidebarProfesionalesMenu = ({ onAction }) => {
  const [open, setOpen] = useState({
    crear: true,
    consultas: false,
    modificaciones: false,
    eliminar: false
  });

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
  <div className="sidebar-profesionales-menu p-2" style={{ background: '#0d6efd', minHeight: '100vh', color: 'white' }}>
  <div className="mb-2" style={{marginTop: '100px'}}>
        <button
          className="btn btn-primary w-100 text-start"
          style={{ backgroundColor: '#4d94ff', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '12px 16px', marginBottom: 0 }}
          onClick={() => onAction('registrar')}
        >
          <span className="fw-bold">+ Agregar Profesional</span>
        </button>
        {/* Botón secundario eliminado, solo queda el principal arriba */}
      </div>
      <div className="mb-2">
        <button
          className="btn btn-success w-100 text-start"
          style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '12px 16px', marginBottom: 0 }}
          onClick={() => toggle('consultas')}
        >
          <span className="fw-bold">🔍 Consultas</span>
          <span className="float-end">{open.consultas ? '-' : '+'}</span>
        </button>
        {open.consultas && (
          <div className="mt-2 ms-2">
            <button style={{background:'#fff',color:'#198754',borderRadius:6,fontWeight:600,fontSize:'1rem',padding:'10px 12px',marginBottom:6}} className="w-100" onClick={() => onAction('listar')}>Listar todos los profesionales</button>
            <button style={{background:'#fff',color:'#198754',borderRadius:6,fontWeight:600,fontSize:'1rem',padding:'10px 12px',marginBottom:6}} className="w-100" onClick={() => onAction('consultarPorId')}>Consultar profesional por ID</button>
            {/* Botón 'Listar tipos de profesionales' eliminado */}
            <button style={{background:'#fff',color:'#0dcaf0',borderRadius:6,fontWeight:600,fontSize:'1rem',padding:'10px 12px',marginBottom:6}} className="w-100" onClick={() => onAction('buscarPorTipo')}>Buscar por especialidad</button>
          </div>
        )}
      </div>
      <div className="mb-2">
        <button
          className="btn btn-warning w-100 text-start"
          style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '12px 16px', marginBottom: 0 }}
          onClick={() => toggle('modificaciones')}
        >
          <span className="fw-bold">✏️ Modificaciones</span>
          <span className="float-end">{open.modificaciones ? '-' : '+'}</span>
        </button>
        {open.modificaciones && (
          <div className="mt-2 ms-2">
            <button style={{background:'#fff',color:'#ffc107',borderRadius:6,fontWeight:600,fontSize:'1rem',padding:'10px 12px',marginBottom:6}} className="w-100" onClick={() => onAction('actualizar')}>Actualizar datos del profesional</button>
            <button style={{background:'#fff',color:'#6c757d',borderRadius:6,fontWeight:600,fontSize:'1rem',padding:'10px 12px',marginBottom:6}} className="w-100" onClick={() => onAction('actualizarValorHoraTodos')}>Actualizar valor jornal de todos</button>
            {/* Botón 'Actualizar valor hora de uno' eliminado */}
          </div>
        )}
      </div>
      <div className="mb-2">
        <button
          className="btn btn-danger w-100 text-start"
          style={{ borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', padding: '12px 16px', marginBottom: 0 }}
          onClick={() => toggle('eliminar')}
        >
          <span className="fw-bold">🗑️ Eliminar</span>
          <span className="float-end">{open.eliminar ? '-' : '+'}</span>
        </button>
        {open.eliminar && (
          <div className="mt-2 ms-2">
            <button style={{background:'#fff',color:'#dc3545',borderRadius:6,fontWeight:600,fontSize:'1rem',padding:'10px 12px',marginBottom:6}} className="w-100" onClick={() => onAction('eliminar')}>Eliminar profesional</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarProfesionalesMenu;
