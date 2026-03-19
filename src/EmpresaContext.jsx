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

  // 🔐 useEffect: Cargar permisos si el usuario ya está en localStorage (sesión restaurada)
  useEffect(() => {
    const cargarPermisosIniciales = async () => {
      if (usuarioAutenticado?.rol) {
        console.log('🔐 Usuario restaurado desde localStorage - cargando permisos para rol:', usuarioAutenticado.rol);
        setPermisosLoaded(false);
        try {
          const permisos = await obtenerSeccionesPermitidas(usuarioAutenticado.rol);
          guardarPermisos(permisos);
          console.log('✅ Permisos iniciales cargados:', permisos);
          setPermisosLoaded(true);
        } catch (error) {
          console.error('❌ Error al cargar permisos iniciales:', error);
          setPermisosLoaded(true); // Marcar como cargado incluso en error para evitar loading infinito
        }
      } else {
        // No hay usuario, permisos están "cargados" (vacíos)
        setPermisosLoaded(true);
      }
    };

    cargarPermisosIniciales();
  }, []); // Solo ejecutar una vez al montar el componente

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
  const [permisosLoaded, setPermisosLoaded] = useState(false); // 🔐 Estado para saber si los permisos están cargados

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
    console.log('🏢 [CONTEXTO] setEmpresaSeleccionada llamado con:', empresa);
    setEmpresaSeleccionadaState(empresa);

    // Guardar en localStorage permanentemente
    if (empresa) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
      setCurrentEmpresaId(empresa.id);
      console.log('✅ [CONTEXTO] Empresa actualizada - ID:', empresa.id, 'Nombre:', empresa.nombre);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ [CONTEXTO] Empresa eliminada');
    }
  };

  const setUsuarioAutenticado = async (usuario) => {
    console.log('👤 Usuario autenticado:', usuario);
    setUsuarioAutenticadoState(usuario);
    
    // Guardar usuario en localStorage para persistir sesión
    if (usuario) {
      localStorage.setItem(USER_KEY, JSON.stringify(usuario));
      
      // 🔐 Cargar permisos desde el backend según el rol del usuario
      setPermisosLoaded(false); // Marcar como no cargado mientras hace la petición
      try {
        console.log('🔐 Cargando permisos para rol:', usuario.rol);
        const permisos = await obtenerSeccionesPermitidas(usuario.rol);
        guardarPermisos(permisos);
        console.log('✅ Permisos cargados:', permisos);
        setPermisosLoaded(true); // Marcar como cargado
      } catch (error) {
        console.error('❌ Error al cargar permisos:', error);
        setPermisosLoaded(true); // Marcar como cargado incluso en error
      }
    } else {
      localStorage.removeItem(USER_KEY);
      limpiarPermisos();
      setPermisosLoaded(true); // Sin usuario, los permisos están "listos" (vacíos)
    }
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión y limpiando localStorage...');
    setUsuarioAutenticadoState(null);
    setEmpresaSeleccionadaState(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    limpiarPermisos(); // 🔐 Limpiar permisos guardados
    setPermisosLoaded(true); // Los permisos están "listos" (vacíos)
    setCurrentEmpresaId(null);
  };

  return (
    <EmpresaContext.Provider value={{
      empresaSeleccionada,
      setEmpresaSeleccionada,
      usuarioAutenticado,
      setUsuarioAutenticado,
      logout,
      loading,
      permisosLoaded // 🔐 Exponer estado de carga de permisos
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  return useContext(EmpresaContext);
}
