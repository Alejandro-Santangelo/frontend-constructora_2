import React, { useState, createContext, lazy, Suspense } from 'react';
import { useEmpresa } from './EmpresaContext.jsx';
import { Provider } from 'react-redux';
import { store } from './store';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/NavbarNew';
import Sidebar from './components/SidebarNew';
import FunctionalDashboard from './pages/FunctionalDashboard';
import NotificationToast from './components/NotificationToast';

// 🚀 LAZY LOADING: Cargar páginas solo cuando se necesitan
const EmpresasPage = lazy(() => import('./pages/EmpresasPage'));
const ClientesPage = lazy(() => import('./pages/ClientesPage'));
const ObrasPage = lazy(() => import('./pages/ObrasPage'));
const ProfesionalesPage = lazy(() => import('./pages/ProfesionalesPage'));
const ProfesionalesObrasPage = lazy(() => import('./pages/ProfesionalesObrasPage'));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'));
const PresupuestosNoClientePage = lazy(() => import('./pages/PresupuestosNoClientePage'));
const SistemaFinancieroPage = lazy(() => import('./pages/SistemaFinancieroPage'));
const DiagnosticoBackend = lazy(() => import('./components/DiagnosticoBackend'));

// Componente de carga
const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Cargando...</span>
    </div>
  </div>
);

// Crear contexto para compartir controles del sidebar
export const SidebarContext = createContext(null);

function App() {
  const [notification, setNotification] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
  };
  const hideNotification = () => {
    setNotification(null);
  };

  return (
    <AppLayout
      showNotification={showNotification}
      notification={notification}
      hideNotification={hideNotification}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
    />
  );
}

function AppLayout({ showNotification, notification, hideNotification, sidebarCollapsed, setSidebarCollapsed }) {
  const location = useLocation();
  const [presupuestoControls, setPresupuestoControls] = useState(null);
  const [obrasControls, setObrasControls] = useState(null);
  
  // Definir el ancho del sidebar según el estado
  // Eliminar marginLeft para que el layout no se achique tanto
  // const sidebarWidth = location.pathname !== '/presupuestos' ? (sidebarCollapsed ? 64 : 260) : 0;
  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        collapsed={sidebarCollapsed}
        showNotification={showNotification}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        {location.pathname !== '/presupuestos' && 
         location.pathname !== '/profesionales' && 
         location.pathname !== '/profesionales-obras' && 
         location.pathname !== '/empresas' && 
         location.pathname !== '/clientes' && 
         location.pathname !== '/' && 
         location.pathname !== '/dashboard' && (
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            presupuestoControls={presupuestoControls}
            obrasControls={obrasControls}
          />
        )}
        <main
          className={location.pathname === '/empresas' || location.pathname === '/clientes' || location.pathname === '/presupuestos-no-cliente' || location.pathname === '/presupuestos' || location.pathname === '/obras' ? 'main-content' : 'main-content px-md-4'}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: '100vh',
            background: '#f6f7f9',
            overflowX: 'hidden',
          }}
        >
          <div className="fade-in">
            <SidebarContext.Provider value={{ setPresupuestoControls, setObrasControls }}>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<FunctionalDashboard showNotification={showNotification} />} />
                  <Route path="/dashboard" element={<FunctionalDashboard showNotification={showNotification} />} />
                  <Route path="/empresas" element={<EmpresasPage showNotification={showNotification} />} />
                  <Route path="/clientes" element={<ClientesPage showNotification={showNotification} />} />
                  <Route path="/obras" element={<ObrasPage showNotification={showNotification} />} />
                  <Route path="/profesionales" element={<ProfesionalesPage showNotification={showNotification} />} />
                  <Route path="/profesionales-obras" element={<ProfesionalesObrasPage showNotification={showNotification} />} />
                  <Route path="/profesionales-obra" element={<ProfesionalesObrasPage showNotification={showNotification} />} />
                  <Route path="/usuarios" element={<UsuariosPage showNotification={showNotification} />} />
                  <Route path="/sistema-financiero" element={<SistemaFinancieroPage showNotification={showNotification} setSidebarCollapsed={setSidebarCollapsed} sidebarCollapsed={sidebarCollapsed} />} />
                  <Route path="/diagnostico" element={<DiagnosticoBackend />} />
                  {/* Ruta /presupuestos redirige a /presupuestos-no-cliente */}
                  <Route path="/presupuestos" element={<Navigate to="/presupuestos-no-cliente" replace />} />
                  <Route path="/presupuestos-no-cliente" element={<PresupuestosNoClientePage showNotification={showNotification} />} />
                </Routes>
              </Suspense>
            </SidebarContext.Provider>
          </div>
        </main>
      </div>
      {/* Toast de notificaciones */}
      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          onHide={hideNotification}
        />
      )}
    </div>
  );
}

export default App;