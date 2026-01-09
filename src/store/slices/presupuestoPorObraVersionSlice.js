import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchPresupuestoPorObraVersion = createAsyncThunk(
  'presupuestoPorObraVersion/fetch',
  async ({ empresaId, obraId, version }, { rejectWithValue }) => {
    try {
      let url = `/api/presupuestos/por-obra-version?empresaId=${empresaId}&obraId=${obraId}`;
      if (version) url += `&version=${version}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const presupuestoPorObraVersionSlice = createSlice({
  name: 'presupuestoPorObraVersion',
  initialState: {
    resultado: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPresupuestoPorObraVersion.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.resultado = null;
      })
      .addCase(fetchPresupuestoPorObraVersion.fulfilled, (state, action) => {
        state.loading = false;
        state.resultado = action.payload;
      })
      .addCase(fetchPresupuestoPorObraVersion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default presupuestoPorObraVersionSlice.reducer;
// export { fetchPresupuestoPorObraVersion }; // Solo una exportación, ya está arriba
