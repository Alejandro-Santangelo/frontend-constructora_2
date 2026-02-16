import api from './api';

const BASE_URL = '/api/v1/retiros-personales';

/**
 * Calcular saldo disponible para retiros
 */
export const obtenerSaldoDisponible = async (empresaId) => {
  console.log('📤 [Service] Haciendo petición saldo-disponible con empresaId:', empresaId);
  const response = await api.get(`${BASE_URL}/saldo-disponible`, {
    params: { empresaId }
  });
  console.log('📥 [Service] Respuesta completa:', response);
  console.log('📥 [Service] response.data:', response.data);
  // El interceptor ya extrae los datos, están en response directamente
  return response.data || response;
};

/**
 * Registrar un nuevo retiro personal
 */
export const registrarRetiro = async (retiroData) => {
  try {
    const response = await api.post(BASE_URL, retiroData);
    return response.data || response;
  } catch (error) {
    console.error('Error registrando retiro:', error);
    throw error;
  }
};

/**
 * Listar retiros de una empresa
 */
export const listarRetiros = async (empresaId, filtros = {}) => {
  const params = {
    empresaId,
    ...filtros
  };
  const response = await api.get(BASE_URL, { params });
  return response.data || response;
};

/**
 * Obtener un retiro por ID
 */
export const obtenerRetiro = async (id, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/${id}`, {
      params: { empresaId }
    });
    return response.data || response;
  } catch (error) {
    console.error('Error obteniendo retiro:', error);
    throw error;
  }
};

/**
 * Anular un retiro
 */
export const anularRetiro = async (id, empresaId) => {
  try {
    const response = await api.put(`${BASE_URL}/${id}/anular`, null, {
      params: { empresaId }
    });
    return response.data || response;
  } catch (error) {
    console.error('Error anulando retiro:', error);
    throw error;
  }
};

/**
 * Eliminar un retiro
 */
export const eliminarRetiro = async (id, empresaId) => {
  try {
    await api.delete(`${BASE_URL}/${id}`, {
      params: { empresaId }
    });
  } catch (error) {
    console.error('Error eliminando retiro:', error);
    throw error;
  }
};

/**
 * Obtener totales de retiros
 */
export const obtenerTotales = async (empresaId, fechaDesde = null, fechaHasta = null) => {
  try {
    const params = { empresaId };
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;

    const response = await api.get(`${BASE_URL}/totales`, { params });
    return response.data || response;
  } catch (error) {
    console.error('Error obteniendo totales:', error);
    throw error;
  }
};

/**
 * Formatear moneda
 */
export const formatearMoneda = (monto) => {
  if (!monto && monto !== 0) return '$\u00A00,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto);
};

/**
 * Formatear fecha
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Obtener gastos generales con origen de fondos = RETIRO_DIRECTO
 * (Se muestran en el modal de retiros como "retiros via gastos")
 */
export const listarGastosConRetiroDirecto = async (empresaId) => {
  try {
    console.log('🔍 [GASTOS RETIRO DIRECTO] Iniciando búsqueda para empresa:', empresaId);

    // 1. Obtener todas las obras de la empresa (presupuestos-no-cliente)
    const presupuestosResponse = await api.get('/api/v1/presupuestos-no-cliente', {
      params: { empresaId, aprobado: true }
    });

    const presupuestos = presupuestosResponse.data || presupuestosResponse || [];
    console.log('📊 [GASTOS RETIRO DIRECTO] Presupuestos encontrados:', presupuestos.length);

    if (presupuestos.length === 0) {
      console.log('⚠️ [GASTOS RETIRO DIRECTO] No hay presupuestos aprobados');
      return [];
    }

    // 2. Para cada presupuesto, obtener sus gastos generales
    const gastosPromises = presupuestos.map(async (presupuesto, index) => {
      console.log(`\n🔍 [GASTOS ${index + 1}/${presupuestos.length}] Analizando presupuesto:`, {
        id: presupuesto.id,
        direccionObra: presupuesto.direccionObra,
        tipoPresupuesto: presupuesto.tipoPresupuesto,
        obraId: presupuesto.obraId,
        trabajoExtraId: presupuesto.trabajoExtraId
      });

      try {
        // Determinar si es trabajo extra o no
        const esTrabajoExtra = presupuesto.tipoPresupuesto === 'TRABAJO_EXTRA' ||
                              presupuesto.esTrabajoAdicional ||
                              presupuesto.trabajoExtraId;

        // Buscar la obra asociada
        let obraId = null;
        if (esTrabajoExtra && presupuesto.trabajoExtraId) {
          obraId = presupuesto.trabajoExtraId;
        } else if (presupuesto.obraId) {
          obraId = presupuesto.obraId;
        }

        if (!obraId) {
          console.log(`⚠️ [GASTOS] Presupuesto ${presupuesto.id} sin obraId`);
          return [];
        }

        console.log(`📡 [GASTOS] Obteniendo gastos de obra ${obraId}...`);

        // Obtener información de la obra para tener el nombre correcto
        let nombreObraReal = 'Obra sin nombre';

        // Intentar obtener el nombre del presupuesto
        if (presupuesto.nombreObra) {
          nombreObraReal = presupuesto.nombreObra;
        } else if (presupuesto.nombre) {
          nombreObraReal = presupuesto.nombre;
        } else if (presupuesto.direccionObra) {
          nombreObraReal = presupuesto.direccionObra;
        } else if (presupuesto.descripcion) {
          nombreObraReal = presupuesto.descripcion;
        } else if (presupuesto.clienteNombre) {
          nombreObraReal = `Obra de ${presupuesto.clienteNombre}`;
        } else {
          nombreObraReal = `Obra ${obraId}`;
        }

        // Obtener gastos generales de la obra
        const gastosResponse = await api.get(`/api/obras/${obraId}/otros-costos`, {
          headers: { empresaId: empresaId }
        });

        const gastosObra = gastosResponse.data || gastosResponse || [];
        console.log(`📊 [GASTOS] Obra ${obraId} - Total gastos encontrados:`, gastosObra.length);

        // Log de cada gasto para verificar estructura
        gastosObra.forEach((gasto, gIndex) => {
          console.log(`   Gasto ${gIndex + 1}:`, {
            id: gasto.id,
            descripcion: gasto.descripcion,
            importe: gasto.importeAsignado || gasto.importe,
            estado: gasto.estado,
            origenFondos: gasto.origenFondos,
            tieneOrigenFondos: !!gasto.origenFondos,
            esRetiroDirecto: gasto.origenFondos === 'RETIRO_DIRECTO'
          });
        });

        // Filtrar solo los que tienen origenFondos = 'RETIRO_DIRECTO'
        // Nota: Los gastos pueden no tener campo 'estado', así que solo filtramos por origenFondos
        const gastosRetiroDirecto = gastosObra
          .filter(gasto => {
            const cumpleFiltro = gasto.origenFondos === 'RETIRO_DIRECTO';
            console.log(`   Gasto ${gasto.id} cumple filtro:`, cumpleFiltro);
            return cumpleFiltro;
          })
          .map(gasto => ({
            ...gasto,
            // Información adicional de la obra
            nombreObra: nombreObraReal,
            tipoObra: esTrabajoExtra ? 'Trabajo Extra' : 'Obra Principal',
            presupuestoId: presupuesto.id,
            obraId: obraId,
            // Tipo especial para diferenciarlo de retiros normales
            tipoRegistro: 'GASTO_GENERAL',
            // Agregar estado ACTIVO por defecto para gastos (no tienen este campo en BD)
            estado: gasto.estado || 'ACTIVO'
          }));

        console.log(`✅ [GASTOS] Obra ${obraId} - Gastos con retiro directo:`, gastosRetiroDirecto.length);
        return gastosRetiroDirecto;
      } catch (error) {
        console.error(`❌ [GASTOS] Error obteniendo gastos de presupuesto ${presupuesto.id}:`, error);
        return [];
      }
    });

    // 3. Esperar todas las promesas y aplanar el array
    const gastosArrays = await Promise.all(gastosPromises);
    const todosLosGastos = gastosArrays.flat();

    console.log('🎯 [GASTOS RETIRO DIRECTO] RESULTADO FINAL:', {
      totalGastos: todosLosGastos.length,
      gastos: todosLosGastos.map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        importe: g.importeAsignado || g.importe,
        nombreObra: g.nombreObra,
        tipoObra: g.tipoObra
      }))
    });

    return todosLosGastos;
  } catch (error) {
    console.error('❌ [GASTOS RETIRO DIRECTO] Error general:', error);
    throw error;
  }
};

/**
 * Tipos de retiro disponibles
 */
export const TIPOS_RETIRO = {
  GANANCIA: 'Ganancia',
  PRESTAMO: 'Préstamo',
  GASTO_PERSONAL: 'Gasto Personal',
  GASTO_GENERAL: 'Gasto General (Retiro)' // 🆕 Nuevo tipo para gastos generales
};

/**
 * Estados de retiro
 */
export const ESTADOS_RETIRO = {
  ACTIVO: 'Activo',
  ANULADO: 'Anulado'
};
