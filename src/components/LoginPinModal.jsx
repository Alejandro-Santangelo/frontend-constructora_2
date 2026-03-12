import React, { useState } from 'react';
import apiService from '../services/api';

export default function LoginPinModal({ onLoginSuccess }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🔐 Intentando login con PIN...');
      const response = await apiService.post('/api/auth/login-pin', { pin });

      console.log('✅ Login exitoso:', response);

      // ❌ NO guardamos en localStorage para forzar login en cada sesión
      // Notificar éxito
      onLoginSuccess(response);

    } catch (err) {
      console.error('❌ Error en login:', err);
      setError('PIN incorrecto. Intenta nuevamente.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Solo números
    if (value.length <= 4) {
      setPin(value);
      setError('');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(36, 59, 85, 0.98) 100%)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
        padding: '48px 40px',
        borderRadius: '20px',
        width: '450px',
        maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        animation: 'slideUp 0.4s ease-out'
      }}>
        {/* Header con icono */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
          }}>
            🔐
          </div>
          <h2 style={{
            margin: 0,
            color: '#2c3e50',
            fontSize: '28px',
            fontWeight: '700',
            letterSpacing: '-0.5px',
            textAlign: 'center'
          }}>
            Bienvenido
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            color: '#6c757d',
            fontSize: '15px',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            Ingresa tu PIN para continuar
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#2c3e50',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              PIN (4 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={handlePinChange}
              placeholder="••••"
              autoFocus
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '24px',
                textAlign: 'center',
                letterSpacing: '12px',
                border: error ? '2px solid #dc3545' : '2px solid #e9ecef',
                borderRadius: '12px',
                outline: 'none',
                transition: 'all 0.3s',
                fontFamily: 'monospace',
                background: '#fff'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = error ? '#dc3545' : '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
            />
            {/* Puntos indicadores */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '16px'
            }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: pin.length >= i
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : '#e9ecef',
                  transition: 'all 0.3s',
                  boxShadow: pin.length >= i ? '0 2px 8px rgba(59, 130, 246, 0.4)' : 'none'
                }} />
              ))}
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '1px solid #fca5a5',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: 'shake 0.5s'
            }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{
                color: '#991b1b',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {error}
              </span>
            </div>
          )}

          {/* Botón de ingresar */}
          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            style={{
              width: '100%',
              padding: '16px',
              background: (loading || pin.length !== 4)
                ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: (loading || pin.length !== 4) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: (loading || pin.length !== 4)
                ? 'none'
                : '0 4px 12px rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => {
              if (!loading && pin.length === 4) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = (loading || pin.length !== 4)
                ? 'none'
                : '0 4px 12px rgba(59, 130, 246, 0.4)';
            }}
          >
            {loading ? (
              <>
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                Verificando...
              </>
            ) : (
              <>
                <span>🔓</span>
                Ingresar
              </>
            )}
          </button>
        </form>

        {/* Info adicional */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderRadius: '10px',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'start',
            gap: '10px'
          }}>
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            <div style={{ flex: 1 }}>
              <p style={{
                margin: 0,
                color: '#1e40af',
                fontSize: '13px',
                fontWeight: '600',
                lineHeight: '1.5'
              }}>
                Si olvidaste tu PIN, contacta al administrador del sistema.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `}</style>
    </div>
  );
}
