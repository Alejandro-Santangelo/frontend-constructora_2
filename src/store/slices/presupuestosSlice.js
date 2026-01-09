import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
// Thunk para filtrar presupuestos por estado
export const filtrarPresupuestosPorEstado = createAsyncThunk(
  'presupuestos/filtrarPorEstado',
  async ({ empresaId, estado, obraId }, { rejectWithValue }) => {
    try {
      let url = `/api/presupuestos/por-estado?empresaId=${empresaId}&estado=${encodeURIComponent(estado)}`;
      if (obraId) url += `&obraId=${obraId}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Thunk para crear presupuesto
export const crearPresupuesto = createAsyncThunk(
  'presupuestos/crearPresupuesto',
  async ({ dto, empresaId, idObra }, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `/api/presupuestos?empresaId=${empresaId}&idObra=${idObra}`,
        dto
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Thunk para obtener todos los presupuestos
export const fetchPresupuestos = createAsyncThunk(
  'presupuestos/fetchPresupuestos',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/presupuestos/todos');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Acción asíncrona para descargar un PDF
export const descargarPDF = createAsyncThunk(
  'presupuestos/descargarPDF',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('http://localhost:8080/api/pdf', {
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Error al generar el PDF');
      }

      const blob = await response.blob();

      // Forzamos el tipo MIME correcto
      const file = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(file);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      return 'PDF descargado correctamente';
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Acción para abrir el PDF directamente en el navegador
export const abrirPDFEnNavegador = createAsyncThunk(
  'presupuestos/abrirPDFEnNavegador',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('http://localhost:8080/api/pdf', {
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Error al generar el PDF');
      }

      const blob = await response.blob();
      const file = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(file);

      // Abrir el PDF en una nueva pestaña del navegador
      window.open(url, '_blank');
      URL.revokeObjectURL(url);

      return 'PDF abierto correctamente en el navegador';
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const presupuestosSlice = createSlice({
  name: 'presupuestos',
  initialState: {
    loading: false,
    error: null,
    presupuestoCreado: null,
    lista: [],
    loadingLista: false,
    errorLista: null,
    resultadosFiltrados: [],
    loadingFiltrar: false,
    errorFiltrar: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(crearPresupuesto.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.presupuestoCreado = null;
      })
      .addCase(crearPresupuesto.fulfilled, (state, action) => {
        state.loading = false;
        state.presupuestoCreado = action.payload;
      })
      .addCase(crearPresupuesto.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Lista de presupuestos
      .addCase(fetchPresupuestos.pending, (state) => {
        state.loadingLista = true;
        state.errorLista = null;
      })
      .addCase(fetchPresupuestos.fulfilled, (state, action) => {
        state.loadingLista = false;
        state.lista = action.payload;
      })
      .addCase(fetchPresupuestos.rejected, (state, action) => {
        state.loadingLista = false;
        state.errorLista = action.payload;
      });
    // Filtrar presupuestos por estado
    builder
      .addCase(filtrarPresupuestosPorEstado.pending, (state) => {
        state.loadingFiltrar = true;
        state.errorFiltrar = null;
        state.resultadosFiltrados = [];
      })
      .addCase(filtrarPresupuestosPorEstado.fulfilled, (state, action) => {
        state.loadingFiltrar = false;
        state.resultadosFiltrados = action.payload;
      })
      .addCase(filtrarPresupuestosPorEstado.rejected, (state, action) => {
        state.loadingFiltrar = false;
        state.errorFiltrar = action.payload;
      });
  },
});

export default presupuestosSlice.reducer;
