import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ================================================================================
// CONFIGURACIÓN DE URL BACKEND
// ================================================================================
// Detectar automáticamente el entorno
const isProduction = import.meta.env.MODE === 'production';
const RAILWAY_BACKEND_URL = 'https://backend-constructora2-production.up.railway.app';

// En producción: usar URL del backend Railway
// En desarrollo: vacío (usa proxy de Vite)
const API_BASE_URL = isProduction ? RAILWAY_BACKEND_URL : '';

console.log('🔧 EmpresasSlice - Modo:', import.meta.env.MODE);
console.log('🔧 EmpresasSlice - Base URL:', API_BASE_URL || '(usando proxy local)');

// Async thunks para llamadas a la API
export const fetchEmpresasActivas = createAsyncThunk(
  'empresas/fetchActivas',
  async (_, { rejectWithValue }) => {
    try {
      const url = `${API_BASE_URL}/api/empresas/activas`;
      console.log('🔄 Fetching empresas activas desde:', url);
      
      const response = await fetch(url, {
        headers: { 'accept': '*/*' }
      });
      if (!response.ok) {
        throw new Error('Error fetching empresas activas');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllEmpresas = createAsyncThunk(
  'empresas/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const url = `${API_BASE_URL}/api/empresas/simple`;
      console.log('🔄 EMPRESAS: Obteniendo lista desde:', url);
      
      const response = await fetch(url, {
        headers: { 'accept': '*/*' }
      });

      if (!response.ok) {
        console.error(`❌ EMPRESAS: Error ${response.status} al cargar empresas. Usando datos de respaldo.`);

        // 🔧 DATOS DE RESPALDO si el backend falla
        const mockEmpresas = [
          {
            id: 1,
            nombreEmpresa: 'Cacho Construcciones',
            razonSocial: 'Cacho Construcciones S.R.L.',
            cuit: '20-12345678-9',
            activo: true
          },
          {
            id: 2,
            nombreEmpresa: 'Empresa Cliente Demo',
            razonSocial: 'Cliente Demo S.A.',
            cuit: '30-87654321-0',
            activo: true
          }
        ];

        console.warn('⚠️ EMPRESAS: Usando empresas MOCK. El backend debe estar funcionando para ver datos reales.');
        return mockEmpresas;
      }

      const data = await response.json();
      console.log('✅ EMPRESAS: Respuesta de /api/empresas/simple:', data);

      // Determinar el array de empresas según el formato de respuesta
      let empresasArray = null;

      if (data && Array.isArray(data.resultado)) {
        empresasArray = data.resultado;
        console.log('📋 EMPRESAS: Formato data.resultado detectado');
      } else if (data && Array.isArray(data.lista)) {
        empresasArray = data.lista;
        console.log('📋 EMPRESAS: Formato data.lista detectado');
      } else if (Array.isArray(data)) {
        empresasArray = data;
        console.log('📋 EMPRESAS: Formato array directo detectado');
      } else if (data && Array.isArray(data.data)) {
        empresasArray = data.data;
        console.log('📋 EMPRESAS: Formato data.data detectado');
      } else {
        console.error('❌ EMPRESAS: Formato inesperado:', data);
        throw new Error('Formato inesperado en la respuesta de empresas simple');
      }

      console.log(`📋 EMPRESAS: Encontradas ${empresasArray.length} empresas:`, empresasArray.map(e => e.nombreEmpresa));
      return empresasArray;
    } catch (error) {
      console.error('❌ EMPRESAS: Error en fetchAllEmpresas:', error);
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  // Cache de empresas
  empresas: [],
  empresasActivas: [],

  // Estados de carga
  loading: false,
  loadingActivas: false,

  // Errores
  error: null,

  // Última actualización del cache
  lastUpdated: null,
};

const empresasSlice = createSlice({
  name: 'empresas',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    invalidateCache: (state) => {
      state.lastUpdated = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch empresas activas
      .addCase(fetchEmpresasActivas.pending, (state) => {
        state.loadingActivas = true;
        state.error = null;
      })
      .addCase(fetchEmpresasActivas.fulfilled, (state, action) => {
        state.loadingActivas = false;
        state.empresasActivas = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchEmpresasActivas.rejected, (state, action) => {
        state.loadingActivas = false;
        state.error = action.payload;
      })

      // Fetch all empresas
      .addCase(fetchAllEmpresas.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllEmpresas.fulfilled, (state, action) => {
        state.loading = false;
        state.empresas = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchAllEmpresas.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, invalidateCache } = empresasSlice.actions;

export default empresasSlice.reducer;

// Selectores útiles
export const selectEmpresas = (state) => state.empresas.empresas;
export const selectEmpresasActivas = (state) => state.empresas.empresasActivas;
export const selectEmpresasLoading = (state) => state.empresas.loading;
export const selectEmpresasActivasLoading = (state) => state.empresas.loadingActivas;
export const selectEmpresasError = (state) => state.empresas.error;
export const selectEmpresasLastUpdated = (state) => state.empresas.lastUpdated;

// Selector para obtener empresa por ID
export const selectEmpresaById = (state, empresaId) =>
  state.empresas.empresasActivas.find(empresa => empresa.id === empresaId) ||
  state.empresas.empresas.find(empresa => empresa.id === empresaId);
