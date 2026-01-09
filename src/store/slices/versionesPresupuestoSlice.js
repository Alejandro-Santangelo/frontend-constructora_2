import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchVersionesPresupuesto = createAsyncThunk(
  'versionesPresupuesto/fetchVersionesPresupuesto',
  async ({ idObra, idPresupuesto }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/presupuestos/versiones`, {
        params: { idObra, idPresupuesto }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const versionesPresupuestoSlice = createSlice({
  name: 'versionesPresupuesto',
  initialState: {
    versiones: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVersionesPresupuesto.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVersionesPresupuesto.fulfilled, (state, action) => {
        state.loading = false;
        state.versiones = action.payload;
      })
      .addCase(fetchVersionesPresupuesto.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default versionesPresupuestoSlice.reducer;
