import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmpresa } from '../EmpresaContext';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllEmpresas } from '../store/slices/empresasSlice';

const EmpresaSelector = ({ 
  value, 
  onChange, 
  placeholder = "Seleccionar espacio de trabajo...",
  required = false,
  className = "form-select",
  showId = true
}) => {
  const { setEmpresaSeleccionada } = useEmpresa();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Redux state
  const empresas = useSelector(state => state.empresas.empresas);

  // Determinar tipo de empresa basándose en características
  const getEmpresaTipo = (empresa) => {
    const nombre = (empresa.nombreEmpresa || empresa.nombre || '').toLowerCase();
    
    // Empresa propia (identificadores comunes)
    if (nombre.includes('cacho') || nombre.includes('propia') || nombre.includes('mi empresa')) {
      return { tipo: 'propia', icon: '⭐', color: '#10b981', label: 'Mi Empresa' };
    }
    
    // Cliente empresa (identificadores de empresas que gestionan)
    if (nombre.includes('gestión') || nombre.includes('administración') || 
        nombre.includes('servicios') || nombre.includes('group') || nombre.includes('s.a')) {
      return { tipo: 'cliente-empresa', icon: '🏢', color: '#3b82f6', label: 'Cliente Empresa' };
    }
    
    // Obra directa (constructoras, obras)
    if (nombre.includes('constructora') || nombre.includes('obra') || 
        nombre.includes('construcción') || nombre.includes('proyecto')) {
      return { tipo: 'obra-directa', icon: '🏗️', color: '#f59e0b', label: 'Obra Directa' };
    }
    
    // Por defecto
    return { tipo: 'general', icon: '📋', color: '#6b7280', label: 'Proyecto' };
  };

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
  loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      await dispatch(fetchAllEmpresas()).unwrap();
    } catch (error) {
      console.error('Error cargando empresas para EmpresaSelector:', error);
      setFetchError(String(error || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (selectedEmpresa) => {
    setEmpresaSeleccionada(selectedEmpresa);
    if (onChange) {
      onChange({
        id: selectedEmpresa.id,
        empresa: selectedEmpresa
      });
    }
    setIsOpen(false);
    // Redirigir a la página principal
    navigate('/');
  };

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Cargando empresas...</option>
      </select>
    );
  }
  if (!loading && fetchError) {
    return (
      <div>
        <div className="alert alert-warning">No se pudieron cargar las empresas: {fetchError}</div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={loadEmpresas}>Reintentar</button>
        </div>
      </div>
    );
  }

  const selectedEmpresa = empresas.find(e => e.id == value);
  const selectedTipo = selectedEmpresa ? getEmpresaTipo(selectedEmpresa) : null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Input display */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '12px 16px',
          background: '#fff',
          border: '2px solid #e9ecef',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          borderColor: isOpen ? '#667eea' : '#e9ecef'
        }}
      >
        {selectedEmpresa ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <span style={{ fontSize: '20px' }}>{selectedTipo.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: '#2c3e50', fontSize: '15px' }}>
                {selectedEmpresa.nombreEmpresa || selectedEmpresa.nombre || selectedEmpresa.razonSocial}
              </div>
              {showId && (
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                  ID: {selectedEmpresa.id}
                </div>
              )}
            </div>
            <span 
              style={{
                padding: '4px 10px',
                background: selectedTipo.color + '20',
                color: selectedTipo.color,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {selectedTipo.label}
            </span>
          </div>
        ) : (
          <span style={{ color: '#adb5bd', fontSize: '15px' }}>{placeholder}</span>
        )}
        <i 
          className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} 
          style={{ 
            color: '#6c757d', 
            marginLeft: '12px',
            transition: 'transform 0.2s ease'
          }}
        />
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            background: '#fff',
            border: '2px solid #e9ecef',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000,
            animation: 'slideDown 0.2s ease-out'
          }}
        >
          {empresas.filter(empresa => empresa && empresa.id).map(empresa => {
            const tipo = getEmpresaTipo(empresa);
            const isSelected = empresa.id == value;
            
            return (
              <div
                key={`empresa-${empresa.id}`}
                onClick={() => handleSelect(empresa)}
                style={{
                  padding: '14px 16px',
                  cursor: 'pointer',
                  background: isSelected ? '#f8f9fa' : '#fff',
                  borderBottom: '1px solid #f1f3f5',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected ? '#f8f9fa' : '#fff';
                }}
              >
                <span style={{ fontSize: '20px' }}>{tipo.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: isSelected ? '700' : '600', 
                    color: '#2c3e50', 
                    fontSize: '15px' 
                  }}>
                    {empresa.nombreEmpresa || empresa.nombre || empresa.razonSocial || empresa.cuit || empresa.id}
                  </div>
                  {showId && (
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                      ID: {empresa.id}
                    </div>
                  )}
                </div>
                <span 
                  style={{
                    padding: '4px 10px',
                    background: tipo.color + '20',
                    color: tipo.color,
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {tipo.label}
                </span>
                {isSelected && (
                  <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: '16px' }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default EmpresaSelector;