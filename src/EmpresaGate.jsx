import React from 'react';
import { useEmpresa } from './EmpresaContext';
import SeleccionarEmpresaModal from './components/SeleccionarEmpresaModal';

export default function EmpresaGate({ children }) {
  const { empresaSeleccionada, loading, setEmpresaSeleccionada } = useEmpresa();

  console.log('🚪 EmpresaGate render - Empresa:', empresaSeleccionada);

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

  // Si no hay empresa, mostrar modal obligatorio
  if (!empresaSeleccionada) {
    console.log('❌ No hay empresa - mostrando modal');
    return <SeleccionarEmpresaModal onSelect={setEmpresaSeleccionada} />;
  }

  // Renderizar app normal
  console.log('✅ Hay empresa - renderizando app');
  return children;
}
