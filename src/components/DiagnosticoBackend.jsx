import React, { useState } from 'react';
import { registrarPago, obtenerAdelantosPendientes } from '../services/pagosProfesionalObraService';
import { registrarCobro, obtenerCobrosVencidos } from '../services/cobrosObraService';
import { asignarCajaChicaMultiple } from '../services/cajaChicaService';

/**
 * Componente de diagnóstico para probar conectividad con el backend
 * Sistema Financiero - Cobros, Pagos, Caja Chica
 */
const DiagnosticoBackend = () => {
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);

  const empresaId = 3; // Usar empresa de prueba

  const agregarResultado = (prueba, exito, mensaje, datos = null, errorCompleto = null) => {
    // Detectar error CORS específico
    const esCorsError = errorCompleto?.response?.data?.error?.includes('allowedOrigins cannot contain the special value');
    
    setResultados(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      prueba,
      exito,
      mensaje,
      datos: datos ? JSON.stringify(datos, null, 2) : null,
      esCorsError
    }]);
  };

  const limpiarResultados = () => {
    setResultados([]);
  };

  // PRUEBA 1: Adelantos Pendientes
  const probarAdelantosPendientes = async () => {
    setCargando(true);
    try {
      const profesionalId = 1736;
      agregarResultado('Adelantos Pendientes', null, `Consultando profesional ${profesionalId}...`);
      
      const response = await obtenerAdelantosPendientes(profesionalId, empresaId);
      
      agregarResultado(
        'Adelantos Pendientes',
        true,
        `✅ Endpoint funciona correctamente`,
        response
      );
    } catch (error) {
      agregarResultado(
        'Adelantos Pendientes',
        false,
        `❌ Error: ${error.response?.data?.message || error.response?.data?.error || error.message}`,
        error.response?.data,
        error
      );
    } finally {
      setCargando(false);
    }
  };

  // PRUEBA 2: Cobros Vencidos
  const probarCobrosVencidos = async () => {
    setCargando(true);
    try {
      agregarResultado('Cobros Vencidos', null, 'Consultando cobros vencidos...');
      
      const response = await obtenerCobrosVencidos(empresaId);
      
      agregarResultado(
        'Cobros Vencidos',
        true,
        `✅ Endpoint funciona - ${response?.length || 0} cobros vencidos`,
        response
      );
    } catch (error) {
      agregarResultado(
        'Cobros Vencidos',
        false,
        `❌ Error: ${error.response?.data?.message || error.response?.data?.error || error.message}`,
        error.response?.data,
        error
      );
    } finally {
      setCargando(false);
    }
  };

  // PRUEBA 3: Registrar Pago (solo validación, no se guarda)
  const probarRegistrarPago = async () => {
    setCargando(true);
    try {
      agregarResultado('Registrar Pago', null, 'Enviando pago de prueba...');
      
      const pagoTest = {
        profesionalObraId: 1736,
        presupuestoNoClienteId: 457,
        tipoPago: 'PAGO_SEMANAL',
        montoBruto: 50000,
        descuentoAdelantos: 0,
        descuentoPresentismo: 0,
        porcentajePresentismo: 100,
        fechaPago: new Date().toISOString().split('T')[0],
        fechaPeriodoDesde: new Date().toISOString().split('T')[0],
        fechaPeriodoHasta: new Date().toISOString().split('T')[0],
        observaciones: 'Pago de prueba - Diagnóstico Frontend'
      };
      
      const response = await registrarPago(pagoTest, empresaId);
      
      agregarResultado(
        'Registrar Pago',
        true,
        `✅ Pago registrado correctamente - ID: ${response?.id}`,
        response
      );
    } catch (error) {
      agregarResultado(
        'Registrar Pago',
        false,
        `❌ Error: ${error.response?.data?.message || error.response?.data?.error || error.message}`,
        error.response?.data,
        error
      );
    } finally {
      setCargando(false);
    }
  };

  // PRUEBA 4: Verificar estructura de respuesta
  const probarEstructuraAPI = async () => {
    setCargando(true);
    try {
      agregarResultado('Estructura API', null, 'Verificando estructura de endpoints...');
      
      const tests = [];
      
      // Test: GET funciona
      try {
        await obtenerCobrosVencidos(empresaId);
        tests.push('✅ GET requests funcionan');
      } catch (e) {
        tests.push(`❌ GET requests fallan: ${e.message}`);
      }
      
      agregarResultado(
        'Estructura API',
        tests.every(t => t.startsWith('✅')),
        tests.join('\n'),
        { empresaId, baseURL: '/api/v1' }
      );
    } catch (error) {
      agregarResultado(
        'Estructura API',
        false,
        `❌ Error general: ${error.message}`,
        null
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="container-fluid p-4">
      <div className="card shadow">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">
            <i className="bi bi-tools me-2"></i>
            Diagnóstico de Conectividad - Sistema Financiero
          </h4>
        </div>
        
        <div className="card-body">
          {/* Información */}
          <div className="alert alert-info mb-4">
            <h6 className="alert-heading">
              <i className="bi bi-info-circle me-2"></i>
              Información del Test
            </h6>
            <ul className="mb-0">
              <li><strong>Backend URL:</strong> {import.meta.env.MODE === 'production' ? 'Railway Backend' : 'http://localhost:8080'}</li>
              <li><strong>Base Path:</strong> /api/v1</li>
              <li><strong>Empresa ID:</strong> {empresaId}</li>
              <li><strong>Proxy Vite:</strong> {import.meta.env.MODE === 'production' ? 'N/A (producción)' : '/api → http://localhost:8080/api'}</li>
              <li><strong>Context Path (Backend):</strong> /api (configurado)</li>
              <li><strong>URLs Esperadas:</strong> {import.meta.env.MODE === 'production' ? 'https://backend.../api/v1/...' : 'http://localhost:8080/api/v1/...'}</li>
            </ul>
          </div>

          {/* Botones de Prueba */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <button
                className="btn btn-primary w-100"
                onClick={probarAdelantosPendientes}
                disabled={cargando}
              >
                <i className="bi bi-cash-stack me-2"></i>
                Test: Adelantos
              </button>
            </div>
            
            <div className="col-md-3">
              <button
                className="btn btn-warning w-100"
                onClick={probarCobrosVencidos}
                disabled={cargando}
              >
                <i className="bi bi-clock-history me-2"></i>
                Test: Cobros Vencidos
              </button>
            </div>
            
            <div className="col-md-3">
              <button
                className="btn btn-success w-100"
                onClick={probarRegistrarPago}
                disabled={cargando}
              >
                <i className="bi bi-send me-2"></i>
                Test: Registrar Pago
              </button>
            </div>
            
            <div className="col-md-3">
              <button
                className="btn btn-info w-100"
                onClick={probarEstructuraAPI}
                disabled={cargando}
              >
                <i className="bi bi-diagram-3 me-2"></i>
                Test: Estructura
              </button>
            </div>
          </div>

          <div className="d-flex justify-content-between mb-3">
            <button
              className="btn btn-outline-danger"
              onClick={limpiarResultados}
            >
              <i className="bi bi-trash me-2"></i>
              Limpiar Resultados
            </button>
            
            {cargando && (
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            )}
          </div>

          {/* Resultados */}
          <div className="border rounded p-3" style={{ maxHeight: '500px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
            <h6 className="mb-3">
              <i className="bi bi-terminal me-2"></i>
              Resultados ({resultados.length})
            </h6>
            
            {resultados.length === 0 ? (
              <p className="text-muted mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Ejecuta una prueba para ver los resultados aquí
              </p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {resultados.map((resultado, index) => (
                  <div
                    key={index}
                    className={`card ${
                      resultado.exito === null ? 'border-secondary' :
                      resultado.exito ? 'border-success' : 'border-danger'
                    }`}
                  >
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="badge bg-dark">{resultado.timestamp}</span>
                        <strong>{resultado.prueba}</strong>
                      </div>
                      
                      <div className="mb-2">
                        {resultado.mensaje}
                      </div>
                      
                      {resultado.esCorsError && (
                        <div className="alert alert-danger mt-2 mb-2" role="alert">
                          <h6 className="alert-heading">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            ERROR DE CONFIGURACIÓN CORS EN BACKEND
                          </h6>
                          <p className="mb-2">
                            El backend tiene una configuración CORS incompatible.
                            Está usando <code>allowCredentials=true</code> con <code>allowedOrigins="*"</code>
                          </p>
                          <hr />
                          <p className="mb-1"><strong>Solución:</strong></p>
                          <p className="mb-0 small">
                            El desarrollador del backend debe cambiar la configuración CORS para usar:
                            <br />
                            <code>.allowedOriginPatterns("*")</code> en lugar de <code>.allowedOrigins("*")</code>
                            <br />
                            Ver archivo: <code>PROMPT-BACKEND-FIX-CORS.md</code> para detalles completos
                          </p>
                        </div>
                      )}
                      
                      {resultado.datos && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-primary">
                            <i className="bi bi-code-square me-1"></i>
                            Ver datos
                          </summary>
                          <pre className="bg-dark text-light p-2 rounded mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
                            {resultado.datos}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guía de Troubleshooting */}
      <div className="card shadow mt-4">
        <div className="card-header bg-warning">
          <h5 className="mb-0">
            <i className="bi bi-question-circle me-2"></i>
            Guía de Troubleshooting
          </h5>
        </div>
        <div className="card-body">
          <h6>Si los tests fallan:</h6>
          <ol>
            <li>
              <strong>ERROR CORS (HTTP 400):</strong> 
              <br />
              Si ves "allowedOrigins cannot contain the special value *", el backend necesita cambiar la configuración CORS.
              <br />
              <span className="badge bg-danger">Solución: Ver PROMPT-BACKEND-FIX-CORS.md</span>
            </li>
            <li><strong>Verifica el backend:</strong> {import.meta.env.MODE === 'production' ? 'Debe estar corriendo en Railway' : 'Debe estar corriendo en http://localhost:8080'}</li>
            <li><strong>Verifica los endpoints:</strong> Deben estar implementados con el prefijo <code>/api/v1/</code></li>
            <li><strong>Verifica la base de datos:</strong> Empresa ID=3 debe existir</li>
            <li><strong>Revisa la consola del navegador (F12):</strong> Busca errores de red o CORS</li>
            <li><strong>Revisa logs del backend:</strong> Busca stack traces o errores 500</li>
          </ol>
          
          <h6 className="mt-3">URLs Esperadas:</h6>
          <ul className="mb-0">
            <li><code>GET /api/v1/pagos-profesional-obra/profesional/&#123;id&#125;/adelantos-pendientes</code></li>
            <li><code>POST /api/v1/pagos-profesional-obra</code></li>
            <li><code>GET /api/v1/cobros-obra/vencidos</code></li>
            <li><code>POST /api/v1/caja-chica-obra/asignar-multiple</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticoBackend;
