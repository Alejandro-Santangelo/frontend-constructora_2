import api from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Servicio para gestión de adelantos a profesionales
 * Los adelantos son pagos anticipados que se descuentan de futuros pagos
 *
 * Backend: Usa el endpoint de pagos con flag esAdelanto=true
 */

// ========== FORMATEO ==========

export const formatearMoneda = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) return '$0.00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(valor);
};

// ========== TIPOS DE ADELANTO ==========

export const TIPOS_ADELANTO = {
  SEMANAL: '1_SEMANA',
  QUINCENAL: '2_SEMANAS',
  MENSUAL: '1_MES',
  TOTAL_OBRA: 'OBRA_COMPLETA',
  MONTO_FIJO: 'MONTO_FIJO'
};

export const TIPOS_ADELANTO_LABELS = {
  '1_SEMANA': 'Adelanto Semanal (1 semana)',
  '2_SEMANAS': 'Adelanto Quincenal (2 semanas)',
  '1_MES': 'Adelanto Mensual (4 semanas)',
  'OBRA_COMPLETA': 'Adelanto Total de la Obra',
  'MONTO_FIJO': 'Monto Fijo Personalizado'
};

// ========== CÁLCULOS DE ADELANTO ==========

/**
 * Calcula el monto estimado de un adelanto según el tipo
 */
export const calcularMontoEstimado = (profesional, tipoAdelanto, porcentaje = 50) => {
  if (!profesional) return 0;

  const porcentajeDecimal = porcentaje / 100;
  let montoBase = 0;

  switch (tipoAdelanto) {
    case TIPOS_ADELANTO.SEMANAL:
      // Estimación: jornal promedio por semana
      montoBase = (profesional.precioJornal || 0) * 5; // 5 días laborables
      break;

    case TIPOS_ADELANTO.QUINCENAL:
      // 2 semanas
      montoBase = (profesional.precioJornal || 0) * 10;
      break;

    case TIPOS_ADELANTO.MENSUAL:
      // 4.33 semanas en promedio
      montoBase = (profesional.precioJornal || 0) * 21.65; // ~22 días laborables/mes
      break;

    case TIPOS_ADELANTO.TOTAL_OBRA:
      // Saldo pendiente completo
      montoBase = profesional.saldoPendiente || profesional.saldo || 0;
      break;

    default:
      montoBase = 0;
  }

  return montoBase * porcentajeDecimal;
};

/**
 * Valida que el adelanto sea posible
 */
export const validarAdelanto = (profesional, montoAdelanto) => {
  const errores = [];

  if (!profesional) {
    errores.push('Debe seleccionar un profesional');
    return { valido: false, errores };
  }

  if (montoAdelanto <= 0) {
    errores.push('El monto debe ser mayor a $0');
  }

  const saldoDisponible = profesional.saldoPendiente || profesional.saldo || 0;
  const adelantosActivos = profesional.adelantosActivos || 0;
  const disponibleReal = saldoDisponible - adelantosActivos;

  if (disponibleReal <= 0) {
    errores.push('No hay saldo disponible para adelantar');
  }

  if (montoAdelanto > disponibleReal) {
    errores.push(`El monto excede el saldo disponible (${formatearMoneda(disponibleReal)})`);
  }

  return {
    valido: errores.length === 0,
    errores,
    disponibleReal
  };
};

// ========== CRUD DE ADELANTOS ==========

/**
 * Registra un nuevo adelanto
 * Backend maneja automáticamente: estadoAdelanto, saldoAdelantoPorDescontar, montoOriginalAdelanto
 */
export const registrarAdelanto = async (adelantoData, empresaId) => {
  try {
    console.log('📤 REGISTRAR ADELANTO - Datos enviados:', {
      url: '/api/v1/pagos-profesional-obra',
      body: adelantoData,
      empresaId
    });

    // 🎯 Estructura según PagoProfesionalObraRequestDTO del backend
    const pagoAdelanto = {
      profesionalObraId: adelantoData.profesionalObraId,
      empresaId: empresaId,
      tipoPago: 'ADELANTO',
      esAdelanto: true,
      periodoAdelanto: adelantoData.tipoAdelanto,
      montoBruto: adelantoData.montoAdelanto,
      fechaPago: new Date().toISOString().split('T')[0],
      metodoPago: adelantoData.metodoPago || 'EFECTIVO',
      comprobantePago: adelantoData.comprobantePago || null,
      observaciones: adelantoData.observaciones ||
        `💸 ADELANTO ${TIPOS_ADELANTO_LABELS[adelantoData.tipoAdelanto]} - Monto: ${formatearMoneda(adelantoData.montoAdelanto)}`
    };

    // ⚠️ Backend inicializa automáticamente:
    // - estadoAdelanto = 'ACTIVO'
    // - saldoAdelantoPorDescontar = montoBruto
    // - montoOriginalAdelanto = montoBruto
    // - montoFinal = montoBruto

    const response = await api.post('/api/v1/pagos-profesional-obra', pagoAdelanto);
    console.log('✅ ADELANTO REGISTRADO:', response);

    // 🔔 Emitir evento para sincronización
    console.log('📣 [SERVICIO] Emitiendo evento ADELANTO_REGISTRADO...');
    eventBus.emit(FINANCIAL_EVENTS.PAGO_REGISTRADO, {
      pago: response,
      esAdelanto: true,
      profesionalObraId: adelantoData.profesionalObraId,
      empresaId
    });
    console.log('📣✅ [SERVICIO] Evento ADELANTO_REGISTRADO emitido');

    return response;
  } catch (error) {
    console.error('❌ Error registrando adelanto:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      fullError: error
    });
    throw error;
  }
};

/**
 * Lista adelantos activos de un profesional
 */
export const listarAdelantosActivos = async (profesionalObraId, empresaId) => {
  try {
    // 🎯 Obtener todos los pagos y filtrar localmente
    // El backend no tiene endpoint específico para filtrar adelantos activos
    const pagos = await api.get('/api/v1/pagos-profesional-obra', {
      params: {
        profesionalObraId,
        empresaId
      }
    });

    // Filtrar solo adelantos activos (con saldo por descontar)
    const adelantosActivos = (Array.isArray(pagos) ? pagos : []).filter(p =>
      p.profesionalObraId === profesionalObraId &&
      p.esAdelanto === true &&
      p.estadoAdelanto === 'ACTIVO' &&
      (p.saldoAdelantoPorDescontar || 0) > 0
    );

    console.log('📋 Adelantos activos encontrados:', adelantosActivos.length);
    return adelantosActivos;
  } catch (error) {
    console.error('❌ Error listando adelantos activos:', error);
    return []; // Retornar array vacío en caso de error
  }
};

/**
 * Obtiene el total de adelantos activos de un profesional
 */
export const obtenerTotalAdelantosActivos = async (profesionalObraId, empresaId) => {
  try {
    const adelantos = await listarAdelantosActivos(profesionalObraId, empresaId);
    const total = adelantos.reduce((sum, a) => sum + (a.saldoAdelantoPorDescontar || 0), 0);
    return total;
  } catch (error) {
    console.error('❌ Error obteniendo total de adelantos activos:', error);
    return 0;
  }
};

/**
 * ⚠️ DESCUENTO AUTOMÁTICO - El backend lo maneja completamente
 * Esta función solo calcula una ESTIMACIÓN para mostrar en la UI
 * El descuento real lo aplica el backend al crear el pago semanal
 */
export const calcularDescuentoEstimado = async (profesionalObraId, montoPago, empresaId) => {
  try {
    const adelantosActivos = await listarAdelantosActivos(profesionalObraId, empresaId);

    if (adelantosActivos.length === 0) {
      return {
        descuentoEstimado: 0,
        montoFinalEstimado: montoPago,
        adelantosAfectados: []
      };
    }

    // 📊 Backend aplica máximo 40% del monto disponible
    const PORCENTAJE_DESCUENTO_MAXIMO = 0.40;
    const totalSaldoPendiente = adelantosActivos.reduce((sum, a) => sum + (a.saldoAdelantoPorDescontar || 0), 0);
    const descuentoMaximo = montoPago * PORCENTAJE_DESCUENTO_MAXIMO;
    const descuentoEstimado = Math.min(descuentoMaximo, totalSaldoPendiente);

    return {
      descuentoEstimado,
      montoFinalEstimado: Math.max(0, montoPago - descuentoEstimado),
      adelantosAfectados: adelantosActivos,
      totalSaldoPendiente
    };
  } catch (error) {
    console.error('❌ Error calculando descuento estimado:', error);
    return {
      descuentoEstimado: 0,
      montoFinalEstimado: montoPago,
      adelantosAfectados: [],
      totalSaldoPendiente: 0
    };
  }
};

/**
 * ⚠️ ACTUALIZACIÓN AUTOMÁTICA - El backend actualiza saldos automáticamente
 * Esta función queda por compatibilidad pero NO se debe usar
 * @deprecated El backend maneja actualizaciones automáticamente
 */
export const actualizarSaldoAdelanto = async (adelantoId, nuevoSaldo, empresaId) => {
  console.warn('⚠️ actualizarSaldoAdelanto está deprecated - El backend actualiza automáticamente');
  // No hacer nada - el backend lo maneja
  return Promise.resolve();
};

// ========== VALIDACIONES Y LÍMITES ==========

/**
 * Constantes de configuración
 */
export const CONFIGURACION_ADELANTOS = {
  PORCENTAJE_MINIMO: 30,
  PORCENTAJE_MAXIMO: 80,
  PORCENTAJE_DEFAULT: 50
};

/**
 * Obtiene el límite de adelanto según políticas de la empresa
 */
export const obtenerLimiteAdelanto = (profesional, tipoAdelanto) => {
  const montoEstimado = calcularMontoEstimado(profesional, tipoAdelanto, 100);
  const limiteMaximo = montoEstimado * (CONFIGURACION_ADELANTOS.PORCENTAJE_MAXIMO / 100);
  return limiteMaximo;
};

export default {
  TIPOS_ADELANTO,
  TIPOS_ADELANTO_LABELS,
  CONFIGURACION_ADELANTOS,
  formatearMoneda,
  calcularMontoEstimado,
  validarAdelanto,
  registrarAdelanto,
  listarAdelantosActivos,
  obtenerTotalAdelantosActivos,
  calcularDescuentoEstimado, // ⭐ Renombrado - solo para estimaciones UI
  actualizarSaldoAdelanto, // ⚠️ Deprecated - backend lo maneja
  obtenerLimiteAdelanto
};
