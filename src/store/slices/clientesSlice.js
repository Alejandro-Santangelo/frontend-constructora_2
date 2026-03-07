import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks para CRUD de clientes
export const fetchClientes = createAsyncThunk(
  'clientes/fetchClientes',
  async ({ empresaId, page = 0, size = 20, sort = 'id', direction = 'ASC' }, { rejectWithValue }) => {
    try {
      const params = {
        empresaId,
        page: page.toString(),
        size: size.toString(),
        sort,
        direction
      };
      
      const data = await api.get('/api/clientes', params);
      console.log('📋 Clientes recibidos del backend:', data);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createCliente = createAsyncThunk(
  'clientes/createCliente',
  async ({ empresaId, clienteData }, { rejectWithValue }) => {
    try {
      const data = await api.post(`/api/clientes?empresaId=${empresaId}`, clienteData);
      console.log('✅ Cliente creado:', data);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const updateCliente = createAsyncThunk(
  'clientes/updateCliente',
  async ({ id, clienteData }, { rejectWithValue }) => {
    try {
      // Limpiar campos que no deben enviarse
      const { empresas, fechaCreacion, ...cleanData } = clienteData;
      
      const data = await api.put(`/api/clientes/${encodeURIComponent(id)}`, cleanData);
      console.log('✅ Cliente actualizado:', data);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const deleteCliente = createAsyncThunk(
  'clientes/deleteCliente',
  async ({ id, empresaId }, { rejectWithValue }) => {
    try {
      await api.delete(`/api/clientes/${encodeURIComponent(id)}?empresaId=${empresaId}`);
      return id; // Retornar el ID para removerlo del state
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const searchClientes = createAsyncThunk(
  'clientes/searchClientes',
  async ({ termino, empresaId }, { rejectWithValue }) => {
    try {
      const data = await api.get(`/api/clientes/buscar?termino=${encodeURIComponent(termino)}&empresaId=${empresaId}`);
      console.log('🔍 Clientes encontrados:', data);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  // Datos
  clientes: [],
  searchResult: null,
  selectedCliente: null,
  
  // Paginación
  pagination: {
    page: 0,
    size: 20,
    sort: 'id',
    direction: 'ASC',
    totalElements: 0,
    totalPages: 0
  },
  
  // Estados de carga
  loading: false,
  searchLoading: false,
  creating: false,
  updating: false,
  deleting: false,
  
  // Errores
  error: null,
  searchError: null,
  
  // UI states
  activeTab: 'lista',
};

const clientesSlice = createSlice({
  name: 'clientes',
  initialState,
  reducers: {
    // UI actions
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setSelectedCliente: (state, action) => {
      state.selectedCliente = action.payload;
    },
    clearSearchResult: (state) => {
      state.searchResult = null;
      state.searchError = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updatePagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch clientes
      .addCase(fetchClientes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchClientes.fulfilled, (state, action) => {
        state.loading = false;
        state.clientes = action.payload.content || action.payload || [];
        // Actualizar información de paginación si está disponible
        if (action.payload.totalElements !== undefined) {
          state.pagination.totalElements = action.payload.totalElements;
          state.pagination.totalPages = action.payload.totalPages;
        }
      })
      .addCase(fetchClientes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create cliente
      .addCase(createCliente.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createCliente.fulfilled, (state, action) => {
        state.creating = false;
        // Agregar el nuevo cliente al inicio de la lista
        state.clientes.unshift(action.payload);
      })
      .addCase(createCliente.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })
      
      // Update cliente
      .addCase(updateCliente.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateCliente.fulfilled, (state, action) => {
        state.updating = false;
        // Actualizar el cliente en la lista
        const index = state.clientes.findIndex(cliente => 
          (cliente.id || cliente.id_cliente) === (action.payload.id || action.payload.id_cliente)
        );
        if (index !== -1) {
          state.clientes[index] = action.payload;
        }
        state.selectedCliente = null;
      })
      .addCase(updateCliente.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })
      
      // Delete cliente
      .addCase(deleteCliente.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteCliente.fulfilled, (state, action) => {
        state.deleting = false;
        // Remover el cliente de la lista
        state.clientes = state.clientes.filter(cliente => 
          (cliente.id || cliente.id_cliente) !== action.payload
        );
      })
      .addCase(deleteCliente.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload;
      })
      
      // Search clientes
      .addCase(searchClientes.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchClientes.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResult = action.payload;
      })
      .addCase(searchClientes.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload;
      });
  },
});

export const {
  setActiveTab,
  setSelectedCliente,
  clearSearchResult,
  clearError,
  updatePagination,
} = clientesSlice.actions;

export default clientesSlice.reducer;

// Selectores útiles
export const selectClientes = (state) => state.clientes.clientes;
export const selectClientesLoading = (state) => state.clientes.loading;
export const selectClientesError = (state) => state.clientes.error;
export const selectSelectedCliente = (state) => state.clientes.selectedCliente;
export const selectSearchResult = (state) => state.clientes.searchResult;
export const selectSearchLoading = (state) => state.clientes.searchLoading;
export const selectActiveTab = (state) => state.clientes.activeTab;
export const selectPagination = (state) => state.clientes.pagination;
export const selectClientesCreating = (state) => state.clientes.creating;
export const selectClientesUpdating = (state) => state.clientes.updating;
export const selectClientesDeleting = (state) => state.clientes.deleting;