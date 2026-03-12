import React, { createContext, useContext, useState, useEffect } from 'react';
import { setCurrentEmpresaId } from './services/api';
import { obtenerSeccionesPermitidas, guardarPermisos, limpiarPermisos } from './services/permisosService';

const EmpresaContext = createContext();

const STORAGE_KEY = 'empresaSeleccionada';
const USER_KEY = 'usuarioAutenticado';

export function EmpresaProvider({ children }) {
  // 🔐 Usuario autenticado - cargado desde localStorage
  const [usuarioAutenticado, setUsuarioAutenticadoState] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error cargando usuario desde localStorage:', error);
      return null;
    }
  });

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

  const setUsuarioAutenticado = async (usuario) => {
    console.log('👤 Usuario autenticado:', usuario);
    setUsuarioAutenticadoState(usuario);
    
    // Guardar usuario en localStorage para persistir sesión
    if (usuario) {
      localStorage.setItem(USER_KEY, JSON.stringify(usuario));
      
      // 🔐 Cargar permisos desde el backend según el rol del usuario
      try {
        console.log('🔐 Cargando permisos para rol:', usuario.rol);
        const permisos = await obtenerSeccionesPermitidas(usuario.rol);
        guardarPermisos(permisos);
        console.log('✅ Permisos cargados:', permisos);
      } catch (error) {
        console.error('❌ Error al cargar permisos:', error);
      }
    } else {
      localStorage.removeItem(USER_KEY);
      limpiarPermisos();
    }
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión y limpiando localStorage...');
    setUsuarioAutenticadoState(null);
    setEmpresaSeleccionadaState(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    limpiarPermisos(); // 🔐 Limpiar permisos guardados
    setCurrentEmpresaId(null);
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
