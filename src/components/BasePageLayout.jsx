import React from 'react';

const BasePageLayout = ({ sidebar, children }) => (
  <div style={{ display: 'flex', minHeight: '100vh', background: 'rgb(246, 247, 249)' }}>
    <aside
      className="sidebar-base"
      style={{
        top: 56,
        left: 0,
        zIndex: 1040,
        minHeight: 'calc(100vh - 56px)',
        position: 'fixed',
        transition: 'left 0.3s',
        background: 'linear-gradient(180deg, #0866c6 0%, #0656a0 100%)',
        color: 'white',
        width: 300,
        minWidth: 300,
        maxWidth: 300,
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
      }}
    >
      {sidebar}
    </aside>
    <main className="main-content px-md-4" style={{flex: '1 1 0%', minWidth: 0, minHeight: '100vh', background: 'rgb(246, 247, 249)', overflowX: 'hidden', marginLeft: 300, padding: '40px 0 0 0', width: 'calc(100% - 300px)'}}>
      {children}
    </main>
  </div>
);

export default BasePageLayout;
