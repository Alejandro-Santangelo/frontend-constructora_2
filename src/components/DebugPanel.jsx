import React, { useState } from 'react';

const DebugPanel = ({ data, title = "Debug Panel" }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '10px 15px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          fontSize: '12px'
        }}
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: isMinimized ? '250px' : '400px',
        maxHeight: isMinimized ? '50px' : '600px',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'move'
        }}
      >
        <span style={{ fontWeight: 'bold' }}>🐛 {title}</span>
        <div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              marginRight: '8px',
              fontSize: '16px'
            }}
          >
            {isMinimized ? '▢' : '▬'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div
          style={{
            padding: '12px',
            overflowY: 'auto',
            maxHeight: '550px'
          }}
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#d4d4d4'
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
