import React, { useState, useEffect } from 'react';

export default function OrientationGuide() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Detectar dispositivos móviles por user agent
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Detectar si tiene touch (dispositivo táctil)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Detectar dispositivos móviles por ancho físico real de pantalla
      const isMobile = window.screen.width < 768 || window.screen.height < 768;

      // ✅ DETECCIÓN DE ORIENTACIÓN: usar innerWidth/innerHeight que SÍ cambian al rotar
      // window.screen.width/height son fijos en iOS, no sirven para detectar rotación
      const isPortrait = window.innerHeight > window.innerWidth;

      // Mostrar guía si es móvil Y está en vertical
      const shouldShow = (isMobile || isMobileUserAgent || isTouchDevice) && isPortrait;

      setShowGuide(shouldShow);
    };

    // MediaQuery listener para iOS (más confiable que orientationchange)
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const handleOrientationChange = (e) => {
      checkOrientation();
    };

    // Verificar al cargar
    checkOrientation();

    // Listener moderno (iOS Safari 14+)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleOrientationChange);
    } else {
      // Fallback para iOS más antiguos
      mediaQuery.addListener(handleOrientationChange);
    }

    // Eventos adicionales
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleOrientationChange);
      } else {
        mediaQuery.removeListener(handleOrientationChange);
      }
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!showGuide) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      padding: '20px',
      textAlign: 'center'
    }}>
      {/* Icono de rotación animado */}
      <div style={{
        fontSize: '80px',
        marginBottom: '30px',
        animation: 'rotate 2s ease-in-out infinite'
      }}>
        📱 ↻
      </div>

      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        marginBottom: '15px',
        color: '#fff'
      }}>
        Para una mejor experiencia
      </h2>

      <p style={{
        fontSize: '16px',
        color: '#e0e0e0',
        maxWidth: '300px',
        lineHeight: '1.6'
      }}>
        Por favor, rota tu dispositivo a modo horizontal
      </p>

      <div style={{
        marginTop: '30px',
        padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#bbb'
      }}>
        <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
        Esta aplicación está optimizada para pantallas horizontales
      </div>

      <style>{`
        @keyframes rotate {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(90deg); }
        }
      `}</style>
    </div>
  );
}
