import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Estado global de la aplicación
  currentTenantId: '1',
  sidebarCollapsed: false,
  
  // Sistema de notificaciones
  notification: null,
  
  // Estados de carga globales
  globalLoading: false,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // Tenant management
    setCurrentTenant: (state, action) => {
      state.currentTenantId = action.payload;
    },
    
    // Sidebar
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
    },
    
    // Notificaciones
    showNotification: (state, action) => {
      state.notification = {
        message: action.payload.message,
        type: action.payload.type || 'info',
        id: Date.now(),
      };
    },
    hideNotification: (state) => {
      state.notification = null;
    },
    
    // Loading global
    setGlobalLoading: (state, action) => {
      state.globalLoading = action.payload;
    },
  },
});

export const {
  setCurrentTenant,
  toggleSidebar,
  setSidebarCollapsed,
  showNotification,
  hideNotification,
  setGlobalLoading,
} = appSlice.actions;

export default appSlice.reducer;

// Selectores útiles
export const selectCurrentTenant = (state) => state.app.currentTenantId;
export const selectSidebarCollapsed = (state) => state.app.sidebarCollapsed;
export const selectNotification = (state) => state.app.notification;
export const selectGlobalLoading = (state) => state.app.globalLoading;