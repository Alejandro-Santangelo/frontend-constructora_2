import axios from 'axios';

// Configuración base de la API
const API_BASE_URL = '/api';

// Crear instancia de axios con configuración específica para empresas
const empresasClient = axios.create({
  baseURL: '/api', // ✅ Ruta relativa para que funcione el proxy de Vite
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

// Interceptor para requests
empresasClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor para responses
empresasClient.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ HTTP ${error.response?.status} - ${error.config?.url}`);
    console.error('📦 Error data:', error.response?.data);
    return Promise.reject(error);
  }
);

// Servicio específico para empresas usando tus endpoints reales
export const empresasService = {
  // Obtener todas las empresas activas (usando /empresas/simple)
  getAll: async () => {
    console.log('🔄 EMPRESAS: Obteniendo lista usando /empresas/simple');
    try {
      const response = await empresasClient.get('/empresas/simple');
      console.log('✅ EMPRESAS: Respuesta completa:', response.data);
      
      // Tu endpoint devuelve ListaConMensajeResponse<EmpresaResponseDTO>
      if (response.data && response.data.datos && Array.isArray(response.data.datos)) {
        console.log('📋 EMPRESAS: Encontrados', response.data.datos.length, 'empresas en datos');
        return response.data.datos;
      } else if (Array.isArray(response.data)) {
        console.log('📋 EMPRESAS: Array directo con', response.data.length, 'empresas');
        return response.data;
      } else {
        console.log('⚠️ EMPRESAS: Estructura inesperada:', response.data);
        console.log('📊 EMPRESAS: Tipo:', typeof response.data);
        console.log('📊 EMPRESAS: Keys:', Object.keys(response.data || {}));
        return [];
      }
    } catch (error) {
      console.error('❌ EMPRESAS: Error en /empresas/simple:', error);
      throw error;
    }
  },

  // Buscar empresa por ID, CUIT o nombre
  getById: async (identificador) => {
    console.log('🔄 EMPRESAS: Búsqueda por identificador:', identificador);
    const response = await empresasClient.get(`/empresas/buscar?q=${encodeURIComponent(identificador)}`);
    return response.data;
  },

  // Crear nueva empresa
  create: async (data) => {
    console.log('🔄 EMPRESAS: Creando empresa:', data);
    const response = await empresasClient.post('/empresas', data);
    console.log('✅ EMPRESAS: Empresa creada:', response.data);
    return response.data;
  },

  // Actualizar empresa
  update: async (identificador, data) => {
    console.log('🔄 EMPRESAS: Actualizando empresa:', identificador, 'con datos:', data);
    const response = await empresasClient.put(`/empresas/${identificador}`, data);
    console.log('✅ EMPRESAS: Empresa actualizada:', response.data);
    return response.data;
  },

  // Eliminar empresa (soft delete)
  delete: async (identificador) => {
    console.log('🔄 EMPRESAS: Eliminando empresa:', identificador);
    const response = await empresasClient.delete(`/empresas/${identificador}`);
    console.log('✅ EMPRESAS: Empresa eliminada');
    return response.data;
  },

  // Obtener empresas activas
  getAllActivas: async () => {
    const response = await empresasClient.get('/empresas/activas');
    return response.data;
  },

  // Obtener empresas con clientes
  getConClientes: async () => {
    const response = await empresasClient.get('/empresas/con-clientes');
    return response.data;
  },

  // Validar CUIT
  validarCuit: async (cuit) => {
    const response = await empresasClient.get(`/empresas/validar-cuit/${cuit}`);
    return response.data;
  },

  // Activar empresa
  activar: async (identificador) => {
    const response = await empresasClient.patch(`/empresas/${identificador}/activar`);
    return response.data;
  },

  // Desactivar empresa
  desactivar: async (identificador) => {
    const response = await empresasClient.patch(`/empresas/${identificador}/desactivar`);
    return response.data;
  }
};

export default empresasService;