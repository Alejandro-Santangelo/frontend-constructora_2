import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllEmpresas } from '../store/slices/empresasSlice';
import api from '../services/api';

export default function SeleccionarEmpresaModal({ onSelect }) {
  const dispatch = useDispatch();
  const empresas = useSelector(state => state.empresas.empresas);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    nombreEmpresa: '',
    cuit: '',
    direccionFiscal: '',
    telefono: '',
    email: '',
    representanteLegal: '',
    activa: true
  });

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      await dispatch(fetchAllEmpresas()).unwrap();
    } catch (error) {
      console.error('Error cargando empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmpresaTipo = (empresa) => {
    const nombre = (empresa.nombreEmpresa || empresa.nombre || '').toLowerCase();

    if (nombre.includes('cacho') || nombre.includes('propia') || nombre.includes('mi empresa')) {
      return { tipo: 'propia', icon: '🏠', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', displayName: 'Mi Empresa' };
    }

    if (nombre.includes('gestión') || nombre.includes('administración') ||
        nombre.includes('servicios') || nombre.includes('group') || nombre.includes('s.a')) {
      return { tipo: 'cliente-empresa', icon: '🏢', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' };
    }

    if (nombre.includes('constructora') || nombre.includes('obra') ||
        nombre.includes('construcción') || nombre.includes('proyecto')) {
      return { tipo: 'obra-directa', icon: '🏗️', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' };
    }

    return { tipo: 'general', icon: '🏗️', color: '#6b7280', gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' };
  };

  const handleSeleccionar = (empresa) => {
    console.log('✅ Empresa seleccionada:', empresa);
    onSelect(empresa);
  };

  const handleCreateEmpresa = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.nombreEmpresa.trim()) {
      alert('El nombre de la empresa es obligatorio');
      return;
    }
    if (!formData.cuit.trim()) {
      alert('El CUIT es obligatorio');
      return;
    }

    try {
      setLoading(true);
      const nuevaEmpresa = await api.post('/api/empresas', formData);
      console.log('✅ Empresa creada:', nuevaEmpresa);

      // Recargar lista de empresas
      await loadEmpresas();

      // Cerrar formulario
      setShowCreateForm(false);

      // Resetear formulario
      setFormData({
        nombreEmpresa: '',
        cuit: '',
        direccionFiscal: '',
        telefono: '',
        email: '',
        representanteLegal: '',
        activa: true
      });

      alert('Empresa creada exitosamente');
    } catch (error) {
      console.error('Error creando empresa:', error);
      alert('Error de conexión al crear la empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.92) 0%, rgba(36, 59, 85, 0.95) 100%)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.3s ease-in-out',
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
        padding: '48px 40px',
        borderRadius: '20px',
        minWidth: '700px',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        animation: 'slideUp 0.4s ease-out',
        transform: 'translateY(0)'
      }}>
        {/* Header - Mi Empresa */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}>
          <div style={{ fontSize: '32px' }}>🏠</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '2px'
            }}>
              Mi Empresa
            </div>
            <div style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '500'
            }}>
              Administrador
            </div>
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
          borderBottom: '2px solid #e9ecef',
          paddingBottom: '24px'
        }}>
          <h2 style={{
            marginBottom: '12px',
            color: '#2c3e50',
            fontSize: '28px',
            fontWeight: '700',
            letterSpacing: '-0.5px'
          }}>
            Selecciona el Contratista con el que vas a Trabajar
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : showCreateForm ? (
          // Formulario de Creación de Empresa
          <form onSubmit={handleCreateEmpresa} style={{ marginTop: '24px' }}>
            <div className="mb-3">
              <label className="form-label" style={{ fontWeight: '600', color: '#2c3e50' }}>
                Nombre de la Empresa *
              </label>
              <input
                type="text"
                className="form-control"
                name="nombreEmpresa"
                value={formData.nombreEmpresa}
                onChange={handleInputChange}
                required
                placeholder="Ej: Mi Empresa Principal"
              />
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontWeight: '600', color: '#2c3e50' }}>
                CUIT *
              </label>
              <input
                type="text"
                className="form-control"
                name="cuit"
                value={formData.cuit}
                onChange={handleInputChange}
                required
                placeholder="Ej: 20-12345678-9"
              />
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontWeight: '600', color: '#2c3e50' }}>
                Dirección Fiscal
              </label>
              <input
                type="text"
                className="form-control"
                name="direccionFiscal"
                value={formData.direccionFiscal}
                onChange={handleInputChange}
                placeholder="Ej: Calle Principal 123"
              />
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label" style={{ fontWeight: '600', color: '#2c3e50' }}>
                  Teléfono
                </label>
                <input
                  type="text"
                  className="form-control"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  placeholder="Ej: 11-1234-5678"
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label" style={{ fontWeight: '600', color: '#2c3e50' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="form-control"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Ej: contacto@empresa.com"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontWeight: '600', color: '#2c3e50' }}>
                Representante Legal
              </label>
              <input
                type="text"
                className="form-control"
                name="representanteLegal"
                value={formData.representanteLegal}
                onChange={handleInputChange}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-primary flex-grow-1"
                disabled={loading}
              >
                {loading ? 'Creando...' : '✓ Crear Empresa'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateForm(false)}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : empresas.length === 0 ? (
          // Mensaje cuando no hay empresas
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '72px', marginBottom: '20px' }}>📭</div>
            <h4 style={{ color: '#2c3e50', marginBottom: '12px' }}>No hay contratistas registrados</h4>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>
              Para comenzar, necesitas crear tu primer contratista
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setShowCreateForm(true)}
            >
              <i className="fas fa-plus me-2"></i>
              Crear Primer Contratista
            </button>
          </div>
        ) : (
          // Lista de Empresas
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginTop: '24px'
            }}>
              {empresas.filter(empresa => empresa && empresa.id).map(empresa => {
              const tipo = getEmpresaTipo(empresa);

              return (
                <div
                  key={`empresa-${empresa.id}`}
                  onClick={() => handleSeleccionar(empresa)}
                  style={{
                    padding: '16px',
                    background: '#fff',
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '100px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = tipo.color;
                    e.currentTarget.style.boxShadow = `0 8px 24px ${tipo.color}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Badge tipo */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '4px 8px',
                    background: tipo.gradient,
                    borderRadius: '6px',
                    fontSize: '18px',
                    lineHeight: 1,
                    boxShadow: `0 2px 8px ${tipo.color}30`
                  }}>
                    {tipo.icon}
                  </div>

                  {/* Nombre empresa */}
                  <div style={{
                    fontWeight: '700',
                    color: '#2c3e50',
                    fontSize: '16px',
                    paddingRight: '40px',
                    lineHeight: '1.3',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {tipo.displayName || empresa.nombreEmpresa || empresa.nombre || empresa.razonSocial || empresa.cuit || `Empresa ${empresa.id}`}
                  </div>

                  {/* ID */}
                  <div style={{
                    fontSize: '11px',
                    color: '#6c757d',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      background: '#f1f3f5',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      ID: {empresa.id}
                    </span>
                  </div>

                  {/* Hover indicator */}
                  <div style={{
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: tipo.color,
                    fontWeight: '600',
                    opacity: 0,
                    transition: 'opacity 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}>
                    <i className="fas fa-arrow-right"></i>
                    <span>Seleccionar</span>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Botón para agregar nueva empresa */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                className="btn btn-outline-primary"
                onClick={() => setShowCreateForm(true)}
              >
                <i className="fas fa-plus me-2"></i>
                Agregar Nueva Empresa
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
