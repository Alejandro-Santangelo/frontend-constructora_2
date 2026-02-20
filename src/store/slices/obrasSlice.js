import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/api';

// ============================================================================
// ASYNC THUNKS PARA CRUD DE OBRAS Y PRESUPUESTOS
// ============================================================================

// Crear presupuesto
export const crearPresupuesto = createAsyncThunk(
  'obras/crearPresupuesto',
  async (presupuestoData, { rejectWithValue }) => {
    try {
  const response = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(presupuestoData)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'Error creando presupuesto'}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Obtener obra por ID
export const fetchObraById = createAsyncThunk(
  'obras/fetchObraById',
  async ({ id, empresaId }, { rejectWithValue }) => {
    try {
      // ✅ Usar apiService para que pase por interceptores
      const data = await apiService.obras.getById(id, empresaId);
      return data;
    } catch (error) {
      console.error('❌ Error en fetchObraById:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Obtener todas las obras
export const fetchTodasObras = createAsyncThunk(
  'obras/fetchTodasObras',
  async (empresaId, { rejectWithValue }) => {
    try {
      console.log('🔄 Fetching todas las obras con empresaId:', empresaId);

      // Usar apiService para que pase por los interceptores de axios
      // que inyectan automáticamente el empresaId
      const data = await apiService.obras.getAll(empresaId);

      console.log('✅ Obras obtenidas exitosamente:', data?.length, 'obras');
      return data;
    } catch (error) {
      console.error('❌ Error en fetchTodasObras:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Obtener obras por empresa
export const fetchObrasPorEmpresa = createAsyncThunk(
  'obras/fetchObrasPorEmpresa',
  async (empresaId, { rejectWithValue }) => {
    try {
      // Usar apiService para que pase por interceptores
      const data = await apiService.obras.getPorEmpresa(empresaId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Obtener obras por cliente
export const fetchObrasPorCliente = createAsyncThunk(
  'obras/fetchObrasPorCliente',
  async (clienteId, { rejectWithValue }) => {
    try {
      // ✅ Usar apiService para que pase por interceptores
      const data = await apiService.obras.getPorCliente(clienteId);
      return data;
    } catch (error) {
      console.error('❌ Error en fetchObrasPorCliente:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Obtener obras por estado
export const fetchObrasPorEstado = createAsyncThunk(
  'obras/fetchObrasPorEstado',
  async ({ estado, empresaId }, { rejectWithValue }) => {
    try {
      const data = await apiService.obras.getPorEstado(estado, empresaId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Obtener obras activas
export const fetchObrasActivas = createAsyncThunk(
  'obras/fetchObrasActivas',
  async (empresaId, { rejectWithValue }) => {
    try {
      // ✅ Backend devuelve obras con estado EN_EJECUCION
      const data = await apiService.obras.getActivas(empresaId);
      console.log('✅ Obras activas obtenidas:', data?.length, 'obras');
      return data;
    } catch (error) {
      console.error('❌ Error en fetchObrasActivas:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Crear nueva obra
export const createObra = createAsyncThunk(
  'obras/createObra',
  async (obraData, { rejectWithValue }) => {
    try {
      console.log('🔄 Creando obra:', obraData);

      // ✅ Usar apiService para que pase por interceptores
      // El interceptor agregará automáticamente:
      // - Header: empresaId: "1"
      // - Header: X-Tenant-ID: "1"
      // - Query param: empresaId=1 (si necesario)
      const data = await apiService.obras.create(obraData);

      console.log('✅ Obra creada exitosamente:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en createObra:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Actualizar obra
export const updateObra = createAsyncThunk(
  'obras/updateObra',
  async ({ id, obraData }, { rejectWithValue }) => {
    try {
      console.log('🔄 Actualizando obra ID:', id, 'con data:', obraData);

      // ✅ Usar apiService para que pase por interceptores
      // Si es borrador, usar endpoint de borrador; si no, endpoint normal
      let data;
      if (obraData.estado === 'BORRADOR' || obraData.estado === 'EN_PLANIFICACION') {
        console.log('📝 Actualizando como borrador');
        data = await apiService.obras.updateBorrador(id, obraData);
      } else {
        console.log('📝 Actualizando obra normal');
        data = await apiService.obras.update(id, obraData);
      }

      console.log('✅ Obra actualizada exitosamente:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en updateObra:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Eliminar obra
export const deleteObra = createAsyncThunk(
  'obras/deleteObra',
  async (id, { rejectWithValue }) => {
    try {
  const response = await fetch(`/api/obras/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return id; // Retornar el ID para removerlo del state
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Cambiar estado de obra
export const cambiarEstadoObra = createAsyncThunk(
  'obras/cambiarEstadoObra',
  async ({ id, estado }, { rejectWithValue, getState }) => {
    try {
      // 1. Cambiar estado de la obra
      const response = await fetch(`/api/obras/${id}/estado?estado=${encodeURIComponent(estado)}`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const obraActualizada = await response.json();

      // 2. 🔄 Sincronizar estado con presupuestos vinculados a esta obra
      try {
        console.log('🔄 Sincronizando presupuestos vinculados a la obra:', { obraId: id, nuevoEstado: estado });

        // Obtener empresaId del estado actual o de la obra actualizada
        const empresaId = obraActualizada.idEmpresa || obraActualizada.empresaId;

        if (!empresaId) {
          console.warn('⚠️ No se puede sincronizar presupuestos: falta empresaId');
          return obraActualizada;
        }

        // Obtener presupuestos vinculados a esta obra usando el método getAll con filtro obraId
        const presupuestos = await apiService.presupuestosNoCliente.getAll(empresaId, { obraId: id });

        if (presupuestos && presupuestos.length > 0) {
          console.log(`📋 Encontrados ${presupuestos.length} presupuesto(s) vinculado(s) a actualizar`);

          // Actualizar estado de cada presupuesto vinculado usando apiService
          const promesasActualizacion = presupuestos.map(presupuesto =>
            apiService.presupuestosNoCliente.actualizarEstado(presupuesto.id, estado, empresaId)
              .catch(err => {
                console.error(`❌ Error actualizando presupuesto ${presupuesto.id}:`, err);
                return null; // Continuar con los demás aunque uno falle
              })
          );

          const resultados = await Promise.all(promesasActualizacion);
          const exitosos = resultados.filter(r => r !== null).length;
          console.log(`✅ ${exitosos}/${presupuestos.length} presupuestos sincronizados exitosamente`);
        } else {
          console.log('ℹ️ No hay presupuestos vinculados a esta obra');
        }
      } catch (syncError) {
        // No fallar si la sincronización falla, solo loggear
        console.warn('⚠️ Error al sincronizar presupuestos vinculados:', syncError);
      }

      return obraActualizada;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Obtener estadísticas
export const fetchEstadisticasObras = createAsyncThunk(
  'obras/fetchEstadisticasObras',
  async (_, { rejectWithValue }) => {
    try {
  const response = await fetch('/api/obras/estadisticas');
      if (!response.ok) {
        throw new Error('Error fetching estadísticas');
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Obtener estados disponibles
export const fetchEstadosDisponibles = createAsyncThunk(
  'obras/fetchEstadosDisponibles',
  async (_, { rejectWithValue }) => {
    try {
  const response = await fetch('/api/obras/estados');
      if (!response.ok) {
        const errorText = await response.text();

        // Si es error 500 y el mensaje contiene "No static resource", endpoint no existe
        if (response.status === 500 && errorText.includes('No static resource')) {
          console.warn('⚠️ Endpoint de estados de obras no implementado. Usando estados por defecto.');
          return [
            'BORRADOR',
            'A_ENVIAR',
            'ENVIADO',
            'APROBADO',
            'EN_EJECUCION',
            'TERMINADO',
            'SUSPENDIDO',
            'CANCELADO'
          ];
        }

        console.error('Error fetching estados:', response.status, errorText);
        // Si falla por otra razón, usar los estados por defecto
        return [
          'BORRADOR',
          'A_ENVIAR',
          'ENVIADO',
          'APROBADO',
          'EN_EJECUCION',
          'TERMINADO',
          'SUSPENDIDO',
          'CANCELADO'
        ];
      }
      const data = await response.json();
      console.log('Estados obtenidos:', data);
      return data;
    } catch (error) {
      console.error('Error en fetchEstadosDisponibles:', error);
      // Fallback a estados por defecto sin mostrar error
      if (error.message.includes('No static resource') || error.message.includes('fetch')) {
        console.warn('⚠️ Backend de estados no disponible. Usando estados por defecto.');
        return [
          'BORRADOR',
          'A_ENVIAR',
          'ENVIADO',
          'APROBADO',
          'EN_EJECUCION',
          'TERMINADO',
          'SUSPENDIDO',
          'CANCELADO'
        ];
      }
      return [
        'BORRADOR',
        'A_ENVIAR',
        'ENVIADO',
        'APROBADO',
        'EN_EJECUCION',
        'TERMINADO',
        'SUSPENDIDO',
        'CANCELADO'
      ];
    }
  }
);

// Obtener profesionales asignados
export const fetchProfesionalesAsignados = createAsyncThunk(
  'obras/fetchProfesionalesAsignados',
  async (obraId, { rejectWithValue }) => {
    try {
  const response = await fetch(`/api/obras/${obraId}/profesionales-asignados`);
      if (!response.ok) {
        throw new Error('Error fetching profesionales asignados');
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Actualizar porcentaje ganancia todos los profesionales
export const actualizarPorcentajeGananciaTodos = createAsyncThunk(
  'obras/actualizarPorcentajeGananciaTodos',
  async ({ obraId, porcentaje }, { rejectWithValue }) => {
    try {
  const response = await fetch(`/api/obras/${obraId}/actualizar-porcentaje-ganancia-todos?porcentaje=${porcentaje}`, {
        method: 'PUT'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Actualizar porcentaje ganancia profesional específico
export const actualizarPorcentajeGananciaProfesional = createAsyncThunk(
  'obras/actualizarPorcentajeGananciaProfesional',
  async ({ obraId, profesionalId, porcentaje }, { rejectWithValue }) => {
    try {
  const response = await fetch(`/api/obras/${obraId}/actualizar-porcentaje-ganancia-profesional?profesionalId=${profesionalId}&porcentaje=${porcentaje}`, {
        method: 'PUT'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  // Datos principales
  obras: [],
  obraSeleccionada: null,
  profesionalesAsignados: [],
  estadisticas: null,
  estadosDisponibles: [
    'BORRADOR',
    'A_ENVIAR',
    'ENVIADO',
    'APROBADO',
    'EN_EJECUCION',
    'TERMINADO',
    'SUSPENDIDO',
    'CANCELADO'
  ],

  // Estados de carga
  loading: false,
  loadingEstadisticas: false,
  loadingProfesionales: false,
  creating: false,
  updating: false,
  deleting: false,

  // Errores
  error: null,

  // UI states
  activeTab: 'lista',
  empresaId: '1',
  estadoFilter: 'todas',

  // Filtros y configuración
  currentView: 'todas', // 'todas', 'empresa', 'cliente', 'estado', 'activas'
};

// ============================================================================
// SLICE
// ============================================================================

const obrasSlice = createSlice({
  name: 'obras',
  initialState,
  reducers: {
    // UI actions
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setObraSeleccionada: (state, action) => {
      state.obraSeleccionada = action.payload;
    },
    setEmpresaId: (state, action) => {
      state.empresaId = action.payload;
    },
    setEstadoFilter: (state, action) => {
      state.estadoFilter = action.payload;
    },
    setCurrentView: (state, action) => {
      state.currentView = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearProfesionalesAsignados: (state) => {
      state.profesionalesAsignados = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch obra por ID
      .addCase(fetchObraById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObraById.fulfilled, (state, action) => {
        state.loading = false;
        state.obraSeleccionada = action.payload;
      })
      .addCase(fetchObraById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch todas las obras
      .addCase(fetchTodasObras.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTodasObras.fulfilled, (state, action) => {
        state.loading = false;
        state.obras = action.payload;
        state.currentView = 'todas';
      })
      .addCase(fetchTodasObras.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch obras por empresa
      .addCase(fetchObrasPorEmpresa.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObrasPorEmpresa.fulfilled, (state, action) => {
        state.loading = false;
        console.log('📋 fetchObrasPorEmpresa.fulfilled - payload:', action.payload);

        // Manejar diferentes formatos de respuesta
        let obrasArray = [];
        if (Array.isArray(action.payload)) {
          obrasArray = action.payload;
        } else if (action.payload?.datos && Array.isArray(action.payload.datos)) {
          obrasArray = action.payload.datos;
        } else if (action.payload?.content && Array.isArray(action.payload.content)) {
          obrasArray = action.payload.content;
        } else if (action.payload?.data && Array.isArray(action.payload.data)) {
          obrasArray = action.payload.data;
        }

        console.log('📋 Obras procesadas:', obrasArray.length, 'items');
        state.obras = obrasArray;
        state.currentView = 'empresa';
      })
      .addCase(fetchObrasPorEmpresa.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch obras por cliente
      .addCase(fetchObrasPorCliente.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObrasPorCliente.fulfilled, (state, action) => {
        state.loading = false;
        state.obras = action.payload;
        state.currentView = 'cliente';
      })
      .addCase(fetchObrasPorCliente.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch obras por estado
      .addCase(fetchObrasPorEstado.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObrasPorEstado.fulfilled, (state, action) => {
        state.loading = false;
        state.obras = action.payload;
        state.currentView = 'estado';
      })
      .addCase(fetchObrasPorEstado.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch obras activas
      .addCase(fetchObrasActivas.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObrasActivas.fulfilled, (state, action) => {
        state.loading = false;
        state.obras = action.payload;
        state.currentView = 'activas';
      })
      .addCase(fetchObrasActivas.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create obra
      .addCase(createObra.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createObra.fulfilled, (state, action) => {
        state.creating = false;
        state.obras.unshift(action.payload);
      })
      .addCase(createObra.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })

      // Update obra
      .addCase(updateObra.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateObra.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.obras.findIndex(obra => obra.id === action.payload.id);
        if (index !== -1) {
          state.obras[index] = action.payload;
        }
        state.obraSeleccionada = null;
      })
      .addCase(updateObra.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })

      // Delete obra
      .addCase(deleteObra.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteObra.fulfilled, (state, action) => {
        state.deleting = false;
        state.obras = state.obras.filter(obra => obra.id !== action.payload);
      })
      .addCase(deleteObra.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload;
      })

      // Cambiar estado obra
      .addCase(cambiarEstadoObra.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(cambiarEstadoObra.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.obras.findIndex(obra => obra.id === action.payload.id);
        if (index !== -1) {
          state.obras[index] = action.payload;
        }
      })
      .addCase(cambiarEstadoObra.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })

      // Fetch estadísticas
      .addCase(fetchEstadisticasObras.pending, (state) => {
        state.loadingEstadisticas = true;
        state.error = null;
      })
      .addCase(fetchEstadisticasObras.fulfilled, (state, action) => {
        state.loadingEstadisticas = false;
        state.estadisticas = action.payload;
      })
      .addCase(fetchEstadisticasObras.rejected, (state, action) => {
        state.loadingEstadisticas = false;
        state.error = action.payload;
      })

      // Fetch estados disponibles
      .addCase(fetchEstadosDisponibles.fulfilled, (state, action) => {
        state.estadosDisponibles = action.payload;
      })

      // Fetch profesionales asignados
      .addCase(fetchProfesionalesAsignados.pending, (state) => {
        state.loadingProfesionales = true;
        state.error = null;
      })
      .addCase(fetchProfesionalesAsignados.fulfilled, (state, action) => {
        state.loadingProfesionales = false;
        state.profesionalesAsignados = action.payload;
      })
      .addCase(fetchProfesionalesAsignados.rejected, (state, action) => {
        state.loadingProfesionales = false;
        state.error = action.payload;
      })

      // Actualizar porcentaje ganancia todos
      .addCase(actualizarPorcentajeGananciaTodos.fulfilled, (state, action) => {
        state.profesionalesAsignados = action.payload;
      })

      // Actualizar porcentaje ganancia profesional
      .addCase(actualizarPorcentajeGananciaProfesional.fulfilled, (state, action) => {
        const index = state.profesionalesAsignados.findIndex(prof => prof.id === action.payload.id);
        if (index !== -1) {
          state.profesionalesAsignados[index] = action.payload;
        }
      })

      // Crear presupuesto
      .addCase(crearPresupuesto.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(crearPresupuesto.fulfilled, (state, action) => {
        state.creating = false;
        // Puedes agregar el nuevo presupuesto a una lista si lo necesitas
        // state.presupuestos.push(action.payload);
      })
      .addCase(crearPresupuesto.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      });
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const {
  setActiveTab,
  setObraSeleccionada,
  setEmpresaId,
  setEstadoFilter,
  setCurrentView,
  clearError,
  clearProfesionalesAsignados
} = obrasSlice.actions;

// export { crearPresupuesto }; // Eliminar export duplicada
export default obrasSlice.reducer;

// Selectores útiles
export const selectObras = (state) => state.obras.obras;
export const selectObraSeleccionada = (state) => state.obras.obraSeleccionada;
export const selectObrasLoading = (state) => state.obras.loading;
export const selectObrasError = (state) => state.obras.error;
export const selectActiveTab = (state) => state.obras.activeTab;
export const selectEmpresaId = (state) => state.obras.empresaId;
export const selectEstadoFilter = (state) => state.obras.estadoFilter;
export const selectEstadosDisponibles = (state) => state.obras.estadosDisponibles;
export const selectProfesionalesAsignados = (state) => state.obras.profesionalesAsignados;
export const selectEstadisticas = (state) => state.obras.estadisticas;
export const selectCurrentView = (state) => state.obras.currentView;

// Selector para obtener obra por ID
export const selectObraById = (state, obraId) =>
  state.obras.obras.find(obra => obra.id === obraId);
