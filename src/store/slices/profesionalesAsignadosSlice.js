import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchProfesionalesAsignados = createAsyncThunk(
  'profesionalesAsignados/fetch',
  async ({ presupuestoId, empresaId, version }, { rejectWithValue }) => {
    try {
      let url = `/api/presupuestos/profesionales-asignados?presupuestoId=${presupuestoId}&empresaId=${empresaId}`;
      if (version) url += `&version=${version}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const profesionalesAsignadosSlice = createSlice({
  name: 'profesionalesAsignados',
  initialState: {
    resultados: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfesionalesAsignados.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.resultados = [];
      })
      .addCase(fetchProfesionalesAsignados.fulfilled, (state, action) => {
        state.loading = false;
        state.resultados = action.payload;
      })
      .addCase(fetchProfesionalesAsignados.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default profesionalesAsignadosSlice.reducer;
// export { fetchProfesionalesAsignados }; // Solo una exportación, ya está arriba
