import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks para llamadas a la API
export const fetchEmpresasActivas = createAsyncThunk(
  'empresas/fetchActivas',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/empresas/activas', {
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
      const response = await fetch('http://localhost:8080/api/empresas/simple', {
        headers: { 'accept': '*/*' }
      });
      
      if (!response.ok) {
        console.error(`❌ Error ${response.status} al cargar empresas. Usando datos de respaldo.`);
        
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
        
        console.warn('⚠️ Usando empresas MOCK. El backend debe estar funcionando para ver datos reales.');
        return mockEmpresas;
      }
      
      const data = await response.json();
      
      // Determinar el array de empresas según el formato de respuesta
      let empresasArray = null;
      
      if (data && Array.isArray(data.resultado)) {
        empresasArray = data.resultado;
      } else if (data && Array.isArray(data.lista)) {
        empresasArray = data.lista;
      } else if (Array.isArray(data)) {
        empresasArray = data;
      } else if (data && Array.isArray(data.data)) {
        empresasArray = data.data;
      } else {
        throw new Error('Formato inesperado en la respuesta de empresas simple');
      }
      
      return empresasArray;
    } catch (error) {
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