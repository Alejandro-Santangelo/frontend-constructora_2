import { configureStore } from '@reduxjs/toolkit';
import clientesReducer from './slices/clientesSlice';
import empresasReducer from './slices/empresasSlice';
import obrasReducer from './slices/obrasSlice';
import appReducer from './slices/appSlice';
import presupuestosReducer from './slices/presupuestosSlice';
import profesionalesAsignadosReducer from './slices/profesionalesAsignadosSlice';
import presupuestoPorObraVersionReducer from './slices/presupuestoPorObraVersionSlice';
import versionesPresupuestoReducer from './slices/versionesPresupuestoSlice';
import versionesPorObraReducer from './slices/versionesPorObraSlice';

export const store = configureStore({
  reducer: {
    clientes: clientesReducer,
    empresas: empresasReducer,
    obras: obrasReducer,
    app: appReducer,
  presupuestos: presupuestosReducer,
  profesionalesAsignados: profesionalesAsignadosReducer,
  presupuestoPorObraVersion: presupuestoPorObraVersionReducer,
  versionesPresupuesto: versionesPresupuestoReducer,
  versionesPorObra: versionesPorObraReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

// Para compatibilidad con JavaScript
export default store;