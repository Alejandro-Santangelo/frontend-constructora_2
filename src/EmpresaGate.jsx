import React from 'react';
import { useEmpresa } from './EmpresaContext';
import LoginPinModal from './components/LoginPinModal';
import SeleccionarEmpresaModal from './components/SeleccionarEmpresaModal';

export default function EmpresaGate({ children }) {
  const { 
    empresaSeleccionada, 
    usuarioAutenticado, 
    loading, 
    setEmpresaSeleccionada,
    setUsuarioAutenticado 
  } = useEmpresa();

  console.log('🚪 EmpresaGate render - Usuario:', usuarioAutenticado, 'Empresa:', empresaSeleccionada);

  // Mostrar spinner mientras carga
  if (loading) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f6f7f9'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Inicializando...</p>
        </div>
      </div>
    );
  }

  // 🔐 PASO 1: Verificar autenticación - si no hay usuario, mostrar login
  if (!usuarioAutenticado) {
    console.log('🔐 No hay usuario autenticado - mostrando login');
    return <LoginPinModal onLoginSuccess={setUsuarioAutenticado} />;
  }

  // 🏢 PASO 2: Si está autenticado pero no seleccionó empresa, mostrar selector
  if (!empresaSeleccionada) {
    console.log('🏢 Usuario autenticado pero sin empresa - mostrando selector');
    return (
      <SeleccionarEmpresaModal 
        onSelect={setEmpresaSeleccionada}
        usuarioAutenticado={usuarioAutenticado}
      />
    );
  }

  // ✅ Usuario autenticado Y empresa seleccionada - renderizar app
  console.log('✅ Usuario y empresa OK - renderizando app');
  return children;
}
