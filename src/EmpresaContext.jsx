import React, { createContext, useContext, useState, useEffect } from 'react';
import { setCurrentEmpresaId } from './services/api';

const EmpresaContext = createContext();

const STORAGE_KEY = 'empresaSeleccionada';

export function EmpresaProvider({ children }) {
  // Cargar empresa desde localStorage
  const [empresaSeleccionada, setEmpresaSeleccionadaState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error cargando empresa desde localStorage:', error);
      return null;
    }
  });
  
  const [loading, setLoading] = useState(false);

  // Sincronizar empresaId con el interceptor de API cada vez que cambie
  useEffect(() => {
    if (empresaSeleccionada?.id) {
      setCurrentEmpresaId(empresaSeleccionada.id);
    }
  }, [empresaSeleccionada]);

  const setEmpresaSeleccionada = (empresa) => {
    console.log('📌 Empresa seleccionada:', empresa);
    setEmpresaSeleccionadaState(empresa);
    
    // Guardar en localStorage permanentemente
    if (empresa) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
      setCurrentEmpresaId(empresa.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <EmpresaContext.Provider value={{ empresaSeleccionada, setEmpresaSeleccionada, loading }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  return useContext(EmpresaContext);
}
