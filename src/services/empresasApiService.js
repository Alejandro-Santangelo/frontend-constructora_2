import apiService from './api';

// Función corregida para empresas usando el endpoint correcto
export const empresasApiService = {
  async getAll() {
    console.log('🔄 EMPRESAS: Obteniendo lista usando /api/empresas/simple');
    
    try {
      const response = await apiService.get('/api/empresas/simple');
      console.log('✅ EMPRESAS: Respuesta de /api/empresas/simple:', response);
      
      // Tu endpoint devuelve: [{ "resultado": [empresas], "mensaje": null }]
      if (Array.isArray(response) && response.length > 0 && response[0].resultado && Array.isArray(response[0].resultado)) {
        console.log('📋 EMPRESAS: Encontradas', response[0].resultado.length, 'empresas en resultado');
        return response[0].resultado;
      } else if (response && response.resultado && Array.isArray(response.resultado)) {
        console.log('📋 EMPRESAS: Encontradas', response.resultado.length, 'empresas en resultado directo');
        return response.resultado;
      } else if (Array.isArray(response)) {
        console.log('📋 EMPRESAS: Array directo con', response.length, 'empresas');
        return response;
      } else {
        console.log('⚠️ EMPRESAS: Estructura inesperada:', response);
        return [];
      }
    } catch (error) {
      console.error('❌ EMPRESAS: Error en /empresas/simple:', error);
      throw error;
    }
  },

  async getById(identificador) {
    console.log('🔄 EMPRESAS: Búsqueda por identificador:', identificador);
    try {
      const response = await apiService.get(`/api/empresas/buscar?q=${encodeURIComponent(identificador)}`);
      console.log('✅ EMPRESAS: Respuesta de búsqueda:', response);
      console.log('📊 EMPRESAS: Tipo de respuesta búsqueda:', typeof response);
      console.log('📊 EMPRESAS: Keys de búsqueda:', Object.keys(response || {}));
      
      // El endpoint de búsqueda devuelve directamente la empresa encontrada
      return response;
    } catch (error) {
      console.error('❌ EMPRESAS: Error en búsqueda:', error);
      throw error;
    }
  },

  async create(data) {
    console.log('🔄 EMPRESAS: Creando empresa:', data);
    const response = await apiService.post('/api/empresas', data);
    console.log('✅ EMPRESAS: Empresa creada:', response);
    return response;
  },

  async update(identificador, data) {
    console.log('🔄 EMPRESAS: Actualizando empresa:', identificador, 'con datos:', data);
    const response = await apiService.put(`/api/empresas/${identificador}`, data);
    console.log('✅ EMPRESAS: Empresa actualizada:', response);
    return response;
  },

  async delete(identificador) {
    console.log('🔄 EMPRESAS: Eliminando empresa:', identificador);
    const response = await apiService.delete(`/api/empresas/${identificador}`);
    console.log('✅ EMPRESAS: Empresa eliminada');
    return response;
  },

  async getAllActivas() {
    const response = await apiService.get('/api/empresas/activas');
    return response;
  },

  async getConClientes() {
    const response = await apiService.get('/api/empresas/con-clientes');
    return response;
  }
};

export default empresasApiService;