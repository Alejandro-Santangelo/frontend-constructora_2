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
 * IMPORTANTE: Usa el saldo pendiente real como base para reflejar el trabajo efectivamente realizado
 */
export const calcularMontoEstimado = (profesional, tipoAdelanto, porcentaje = 50) => {
  if (!profesional) return 0;

  const porcentajeDecimal = porcentaje / 100;
  let montoBase = 0;

  // Obtener el saldo pendiente real (Total asignado - Total pagado)
  const saldoPendiente = profesional.saldoPendiente || profesional.saldo || 0;

  // Si el profesional tiene datos de días trabajados, usar esos para cálculos más precisos
  const diasTrabajados = profesional.diasTrabajados || profesional.totalDias || null;
  const precioJornal = profesional.precioJornal || 0;

  switch (tipoAdelanto) {
    case TIPOS_ADELANTO.SEMANAL:
      // 1 semana = 1/4 del saldo pendiente (asumiendo ~4 semanas trabajadas)
      // Si tiene días trabajados, calcular proporción exacta: (5 días / días totales) * saldo
      if (diasTrabajados && diasTrabajados > 0) {
        const diasSemana = Math.min(5, diasTrabajados); // Máximo 5 días laborables
        montoBase = (diasSemana / diasTrabajados) * saldoPendiente;
      } else {
        // Fallback: 25% del saldo pendiente o jornal × 5 días
        montoBase = Math.max(saldoPendiente * 0.25, precioJornal * 5);
      }
      break;

    case TIPOS_ADELANTO.QUINCENAL:
      // 2 semanas = 1/2 del saldo pendiente (asumiendo ~4 semanas trabajadas)
      // Si tiene días trabajados, calcular proporción exacta: (10 días / días totales) * saldo
      if (diasTrabajados && diasTrabajados > 0) {
        const diasQuincena = Math.min(10, diasTrabajados); // Máximo 10 días laborables
        montoBase = (diasQuincena / diasTrabajados) * saldoPendiente;
      } else {
        // Fallback: 50% del saldo pendiente o jornal × 10 días
        montoBase = Math.max(saldoPendiente * 0.50, precioJornal * 10);
      }
      break;

    case TIPOS_ADELANTO.MENSUAL:
      // 4 semanas = 100% del saldo pendiente (asumiendo que lo trabajado es ~1 mes)
      // O usar días trabajados si están disponibles
      if (diasTrabajados && diasTrabajados > 0) {
        const diasMes = Math.min(22, diasTrabajados); // Máximo ~22 días laborables
        montoBase = (diasMes / diasTrabajados) * saldoPendiente;
      } else {
        // Fallback: 100% del saldo pendiente
        montoBase = saldoPendiente;
      }
      break;

    case TIPOS_ADELANTO.TOTAL_OBRA:
      // Saldo pendiente completo - todo lo que falta pagar
      montoBase = saldoPendiente;
      break;

    default:
      montoBase = 0;
  }

  // Aplicar porcentaje (por defecto 50%, pero puede ser hasta 100%)
  return montoBase * porcentajeDecimal;
};

/**
 * Valida que el adelanto sea posible
 * IMPORTANTE: No valida el límite del 50%, ya que es solo una advertencia
 * Solo valida que haya saldo disponible suficiente
 */
export const validarAdelanto = (profesional, montoAdelanto) => {
  const errores = [];
  const advertencias = [];

  if (!profesional) {
    errores.push('Debe seleccionar un profesional');
    return { valido: false, errores, advertencias };
  }

  if (montoAdelanto <= 0) {
    errores.push('El monto debe ser mayor a $0');
  }

  // Usar datos financieros del backend si están disponibles
  const saldoDisponible = profesional.saldoPendiente || profesional.saldo || 0;
  const totalAdelantosActivos = profesional.totalAdelantosActivos || profesional.adelantosActivos || 0;
  const adelantoDisponible = profesional.adelantoDisponible || (saldoDisponible - totalAdelantosActivos);
  const limiteRecomendado = profesional.limiteAdelanto || (profesional.precioTotal || 0) * 0.5;

  if (saldoDisponible <= 0) {
    errores.push('No hay saldo disponible para adelantar');
  }

  if (montoAdelanto > adelantoDisponible) {
    errores.push(`El monto excede el saldo disponible (${formatearMoneda(adelantoDisponible)})`);
  }

  // Advertencia si excede el 50% recomendado (NO bloquea)
  const totalConNuevo = totalAdelantosActivos + montoAdelanto;
  if (totalConNuevo > limiteRecomendado) {
    const exceso = totalConNuevo - limiteRecomendado;
    advertencias.push(
      `⚠️ El total de adelantos (${formatearMoneda(totalConNuevo)}) excederá el límite recomendado del 50% (${formatearMoneda(limiteRecomendado)}). Exceso: ${formatearMoneda(exceso)}`
    );
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    adelantoDisponible,
    limiteRecomendado,
    excedeLimite: totalConNuevo > limiteRecomendado
  };
};

// ========== CRUD DE ADELANTOS ==========

/**
 * Registra un nuevo adelanto
 * Backend maneja automáticamente: estadoAdelanto, saldoAdelantoPorDescontar, montoOriginalAdelanto
 */
/**
 * Registra un nuevo adelanto usando el endpoint específico de adelantos
 * Backend: POST /api/adelantos
 */
export const registrarAdelanto = async (adelantoData, empresaId) => {
  try {
    console.log('📤 REGISTRAR ADELANTO - Datos enviados:', {
      url: '/api/adelantos',
      body: adelantoData,
      empresaId
    });

    // Estructura según AdelantoRequestDTO del backend
    const adelantoRequest = {
      profesionalObraId: adelantoData.profesionalObraId,
      empresaId: empresaId,
      monto: adelantoData.montoAdelanto,
      fechaPago: new Date().toISOString().split('T')[0],
      periodoAdelanto: adelantoData.tipoAdelanto, // 1_SEMANA, 2_SEMANAS, 1_MES, OBRA_COMPLETA
      metodoPago: (adelantoData.metodoPago || 'EFECTIVO').toLowerCase(), // efectivo, transferencia, cheque
      numeroComprobante: adelantoData.comprobantePago || null,
      motivo: adelantoData.motivo || `Adelanto ${TIPOS_ADELANTO_LABELS[adelantoData.tipoAdelanto]}`,
      observaciones: adelantoData.observaciones ||
        `💸 ADELANTO ${TIPOS_ADELANTO_LABELS[adelantoData.tipoAdelanto]} - Monto: ${formatearMoneda(adelantoData.montoAdelanto)}`,
      aprobadoPor: adelantoData.aprobadoPor || null,
      presupuestoNoClienteId: adelantoData.presupuestoNoClienteId || null
    };

    const response = await api.post('/api/adelantos', adelantoRequest);
    console.log('✅ ADELANTO REGISTRADO:', response);

    // Verificar si excede el límite recomendado del 50%
    if (response.excedeLimiteRecomendado) {
      console.warn('⚠️ ADVERTENCIA:', response.advertencia);
    }

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
 * Backend: GET /api/adelantos/profesional/{profesionalObraId}/pendientes
 */
export const listarAdelantosActivos = async (profesionalObraId, empresaId) => {
  try {
    const response = await api.get(`/api/adelantos/profesional/${profesionalObraId}/pendientes`, {
      params: { empresaId }
    });

    const adelantosActivos = Array.isArray(response) ? response : response?.data || [];
    console.log('📋 Adelantos activos encontrados:', adelantosActivos.length);
    return adelantosActivos;
  } catch (error) {
    console.error('❌ Error listando adelantos activos:', error);
    return []; // Retornar array vacío en caso de error
  }
};

/**
 * Obtiene el total de adelantos activos de un profesional
 * Backend: GET /api/adelantos/profesional/{profesionalObraId}/total-pendiente
 */
export const obtenerTotalAdelantosActivos = async (profesionalObraId, empresaId) => {
  try {
    const response = await api.get(`/api/adelantos/profesional/${profesionalObraId}/total-pendiente`, {
      params: { empresaId }
    });

    const data = response?.data || response;
    return parseFloat(data.totalAdelantosPendientes || 0);
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
 * IMPORTANTE: El límite del 50% es RECOMENDADO, no restrictivo
 * El backend permite excederlo pero genera una advertencia
 */
export const CONFIGURACION_ADELANTOS = {
  PORCENTAJE_MINIMO: 30,
  PORCENTAJE_RECOMENDADO: 50, // Limite recomendado (genera advertencia si se excede)
  PORCENTAJE_MAXIMO: 100, // El frontend permite hasta el 100%, el backend valida solo contra saldo disponible
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
