import React, { createContext, useContext, useState, useEffect } from 'react';
import { setCurrentEmpresaId } from './services/api';

const EmpresaContext = createContext();

const STORAGE_KEY = 'empresaSeleccionada';
const USER_KEY = 'usuarioAutenticado'; // ⚠️ Ya no se usa - el usuario NO se persiste para forzar login

export function EmpresaProvider({ children }) {
  // 🔐 Usuario autenticado - SIEMPRE comienza en null para forzar login con PIN
  // NO se carga desde localStorage para garantizar autenticación en cada sesión
  const [usuarioAutenticado, setUsuarioAutenticadoState] = useState(null);

  // Limpiar cualquier dato de usuario previo del localStorage
  useEffect(() => {
    localStorage.removeItem(USER_KEY);
  }, []);

  // Cargar empresa desde localStorage (solo si hay usuario autenticado)
  const [empresaSeleccionada, setEmpresaSeleccionadaState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const empresa = stored ? JSON.parse(stored) : null;

      // 🔥 CRÍTICO: Establecer empresaId INMEDIATAMENTE para evitar race condition
      // Si esperamos al useEffect, las llamadas API iniciales usarán empresaId=1 por defecto
      if (empresa?.id) {
        setCurrentEmpresaId(empresa.id);
        console.log('🔐 EmpresaId inicializado desde localStorage:', empresa.id);
      }

      return empresa;
    } catch (error) {
      console.error('Error cargando empresa desde localStorage:', error);
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  // 🔐 Validar que no haya empresa sin usuario autenticado (limpiar datos viejos)
  useEffect(() => {
    if (!usuarioAutenticado && empresaSeleccionada) {
      console.log('⚠️ Empresa guardada sin usuario autenticado - limpiando datos viejos');
      setEmpresaSeleccionadaState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [usuarioAutenticado, empresaSeleccionada]);

  // Sincronizar empresaId con el interceptor de API cada vez que cambie
  // (Esto cubre los casos donde cambia después del montaje inicial)
  useEffect(() => {
    if (empresaSeleccionada?.id) {
      setCurrentEmpresaId(empresaSeleccionada.id);
      console.log('🔄 EmpresaId actualizado vía useEffect:', empresaSeleccionada.id);
    }
  }, [empresaSeleccionada]);

  const setEmpresaSeleccionada = (empresa) => {
    setEmpresaSeleccionadaState(empresa);

    // Guardar en localStorage permanentemente
    if (empresa) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
      setCurrentEmpresaId(empresa.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const setUsuarioAutenticado = (usuario) => {
    console.log('👤 Usuario autenticado:', usuario);
    setUsuarioAutenticadoState(usuario);
    // ❌ NO guardamos el usuario en localStorage para forzar login con PIN en cada sesión
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión...');
    setUsuarioAutenticadoState(null);
    setEmpresaSeleccionadaState(null);
    localStorage.removeItem(STORAGE_KEY); // Solo limpiamos la empresa
  };

  return (
    <EmpresaContext.Provider value={{
      empresaSeleccionada,
      setEmpresaSeleccionada,
      usuarioAutenticado,
      setUsuarioAutenticado,
      logout,
      loading
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  return useContext(EmpresaContext);
}
