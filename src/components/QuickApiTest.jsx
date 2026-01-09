import React, { useState } from 'react';

const QuickApiTest = ({ showNotification }) => {
  const [results, setResults] = useState('');
  const [loading, setLoading] = useState(false);

  const testEndpoints = async () => {
    setLoading(true);
    setResults('🚀 Iniciando pruebas...\n\n');
    
    const endpoints = [
      { name: 'Empresas /empresas', url: 'http://localhost:8080/empresas' },
      { name: 'Empresas /api/empresas', url: 'http://localhost:8080/api/empresas' },
      { name: 'Empresas /empresas/activas', url: 'http://localhost:8080/empresas/activas' },
      { name: 'Swagger-UI', url: 'http://localhost:8080/api/swagger-ui/index.html' },
    ];

    for (let endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': '1'
          }
        });

        const status = response.status;
        const statusText = response.statusText;
        
        setResults(prev => prev + `✅ ${endpoint.name}: HTTP ${status} ${statusText}\n`);
        
        if (response.ok && endpoint.name.includes('Empresas')) {
          try {
            const data = await response.json();
            setResults(prev => prev + `   Datos: ${JSON.stringify(data).substring(0, 100)}...\n`);
          } catch (jsonError) {
            setResults(prev => prev + `   Error parsing JSON: ${jsonError.message}\n`);
          }
        }
        
      } catch (error) {
        setResults(prev => prev + `❌ ${endpoint.name}: ${error.message}\n`);
      }
      
      setResults(prev => prev + '\n');
    }
    
    setLoading(false);
    showNotification('Pruebas completadas', 'info');
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-flask me-2"></i>
                Prueba Rápida de Conectividad
              </h5>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Esta herramienta prueba los endpoints básicos sin usar el servicio API.
              </p>
              <button
                className="btn btn-primary"
                onClick={testEndpoints}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-2"></i>
                    Probando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-play me-2"></i>
                    Probar Endpoints
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-terminal me-2"></i>
                Resultados
              </h5>
            </div>
            <div className="card-body">
              <pre 
                className="bg-dark text-light p-3 rounded"
                style={{ height: '400px', overflowY: 'auto', fontSize: '0.9rem' }}
              >
                {results || 'Haz clic en "Probar Endpoints" para comenzar...'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickApiTest;