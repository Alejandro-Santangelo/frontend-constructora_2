import React from 'react';

const PlantillaPageLayout = ({ sidebar, children }) => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <aside
      className="sidebar-base"
      style={{
        top: 56,
        left: 0,
        zIndex: 1000,
        minHeight: 'calc(100vh - 56px)',
        maxHeight: 'calc(100vh - 56px)',
        position: 'fixed',
        transition: 'left 0.3s',
        background: 'linear-gradient(180deg, #0866c6 0%, #0656a0 100%)',
        color: 'white',
        width: 300,
        minWidth: 300,
        maxWidth: 300,
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        padding: 0,
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      {sidebar}
    </aside>
  <main className="main-content" style={{flex: '1 1 0%', minWidth: 0, minHeight: '100vh', background: 'rgb(246, 247, 249)', overflowX: 'hidden', padding: 0, width: '100%'}}>
      {children}
    </main>
  </div>
);

export default PlantillaPageLayout;
