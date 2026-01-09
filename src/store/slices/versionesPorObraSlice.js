import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchVersionesPorObra = createAsyncThunk(
  'versionesPorObra/fetchVersionesPorObra',
  async ({ empresaId, obraId }, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/presupuestos/por-obra-todas-versiones', {
        params: { empresaId, obraId },
        headers: { accept: '*/*' }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const versionesPorObraSlice = createSlice({
  name: 'versionesPorObra',
  initialState: {
    versiones: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVersionesPorObra.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVersionesPorObra.fulfilled, (state, action) => {
        state.loading = false;
        state.versiones = action.payload;
      })
      .addCase(fetchVersionesPorObra.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default versionesPorObraSlice.reducer;
