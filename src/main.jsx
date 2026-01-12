import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import store from './store/index.js'
import App from './App.jsx'
import { EmpresaProvider } from './EmpresaContext.jsx';
import { FinancialDataProvider } from './context/FinancialDataContext.jsx';
import EmpresaGate from './EmpresaGate.jsx';
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import './styles/custom.css'

// Deshabilitar el cambio de valor al hacer scroll en inputs numéricos
// Esto evita que el usuario cambie valores accidentalmente al desplazar la página
document.addEventListener('wheel', (event) => {
  if (document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <EmpresaProvider>
        <FinancialDataProvider>
          <EmpresaGate>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </EmpresaGate>
        </FinancialDataProvider>
      </EmpresaProvider>
    </Provider>
  </React.StrictMode>
)
