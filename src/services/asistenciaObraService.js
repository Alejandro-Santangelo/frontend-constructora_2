import apiService from './api';

/**
 * Servicio para gestión de asistencias de profesionales en obra
 * Incluye check-in/check-out con geolocalización y cálculo de horas trabajadas
 */

/**
 * Registrar entrada (check-in) de un profesional en obra
 * @param {Object} data - Datos del check-in
 * @param {number} data.profesionalObraId - ID de la asignación profesional-obra
 * @param {string} data.fecha - Fecha en formato YYYY-MM-DD
 * @param {string} data.horaEntrada - Hora en formato HH:mm
 * @param {number} data.latitudEntrada - Latitud GPS de entrada
 * @param {number} data.longitudEntrada - Longitud GPS de entrada
 * @param {number} empresaId - ID de la empresa (tenant)
 * @returns {Promise<Object>} Respuesta con la asistencia creada
 */
export const registrarCheckIn = async (data, empresaId) => {
  try {
    const response = await apiService.post(
      '/api/v1/asistencia-obra/check-in',
      data,
      {
        params: { empresaId },
        headers: { 'X-Tenant-ID': empresaId.toString() }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error registrando check-in:', error);
    throw error;
  }
};

/**
 * Registrar salida (check-out) de un profesional en obra
 * El backend calculará automáticamente las horas trabajadas
 * @param {number} asistenciaId - ID de la asistencia a actualizar
 * @param {Object} data - Datos del check-out
 * @param {string} data.horaSalida - Hora en formato HH:mm
 * @param {number} data.latitudSalida - Latitud GPS de salida
 * @param {number} data.longitudSalida - Longitud GPS de salida
 * @param {number} empresaId - ID de la empresa (tenant)
 * @returns {Promise<Object>} Respuesta con la asistencia actualizada
 */
export const registrarCheckOut = async (asistenciaId, data, empresaId) => {
  try {
    const response = await apiService.put(
      `/api/v1/asistencia-obra/${asistenciaId}/check-out`,
      data,
      {
        params: { empresaId },
        headers: { 'X-Tenant-ID': empresaId.toString() }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error registrando check-out:', error);
    throw error;
  }
};

/**
 * Listar asistencias de un profesional en obra
 * @param {number} profesionalObraId - ID de la asignación profesional-obra
 * @param {number} empresaId - ID de la empresa (tenant)
 * @param {string|null} fechaDesde - Fecha desde (opcional) en formato YYYY-MM-DD
 * @param {string|null} fechaHasta - Fecha hasta (opcional) en formato YYYY-MM-DD
 * @returns {Promise<Array>} Lista de asistencias
 */
export const listarAsistenciasPorProfesional = async (profesionalObraId, empresaId, fechaDesde = null, fechaHasta = null) => {
  try {
    const params = { empresaId };
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;

    const response = await apiService.get(
      `/api/v1/asistencia-obra/profesional/${profesionalObraId}`,
      {
        params,
        headers: { 'X-Tenant-ID': empresaId.toString() }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error listando asistencias:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una asistencia específica
 * @param {number} asistenciaId - ID de la asistencia
 * @param {number} empresaId - ID de la empresa (tenant)
 * @returns {Promise<Object>} Detalle de la asistencia
 */
export const obtenerDetalleAsistencia = async (asistenciaId, empresaId) => {
  try {
    const response = await apiService.get(
      `/api/v1/asistencia-obra/${asistenciaId}`,
      {
        params: { empresaId },
        headers: { 'X-Tenant-ID': empresaId.toString() }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalle asistencia:', error);
    throw error;
  }
};

/**
 * Verificar si existe una asistencia activa (sin check-out) para un profesional en una fecha
 * @param {number} profesionalObraId - ID de la asignación profesional-obra
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {number} empresaId - ID de la empresa (tenant)
 * @returns {Promise<Object|null>} Asistencia activa o null si no existe
 */
export const obtenerAsistenciaActiva = async (profesionalObraId, fecha, empresaId) => {
  try {
    const response = await apiService.get(
      `/api/v1/asistencia-obra/hoy/${profesionalObraId}`,
      {
        params: { fecha, empresaId },
        headers: { 'X-Tenant-ID': empresaId.toString() }
      }
    );
    return response.data;
  } catch (error) {
    // Si no hay asistencia activa, el backend puede devolver 404
    if (error.response?.status === 404) {
      return null;
    }
    console.error('Error obteniendo asistencia activa:', error);
    throw error;
  }
};

/**
 * Formatear fecha a DD/MM/YYYY
 * @param {string|Date} fecha - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return '';
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formatear hora a HH:mm
 * @param {string} hora - Hora a formatear (puede venir en varios formatos)
 * @returns {string} Hora formateada
 */
export const formatearHora = (hora) => {
  if (!hora) return '';
  // Si ya está en formato HH:mm, devolverla tal cual
  if (typeof hora === 'string' && hora.match(/^\d{2}:\d{2}$/)) {
    return hora;
  }
  // Si es un objeto Date o timestamp
  const date = new Date(hora);
  if (!isNaN(date.getTime())) {
    return date.toTimeString().substring(0, 5);
  }
  return hora;
};

/**
 * Calcular horas y minutos trabajados entre dos horas
 * @param {string} horaEntrada - Hora de entrada en formato HH:mm
 * @param {string} horaSalida - Hora de salida en formato HH:mm
 * @returns {Object} { horas, minutos, total: "Xh Ym" }
 */
export const calcularHorasTrabajadas = (horaEntrada, horaSalida) => {
  if (!horaEntrada || !horaSalida) {
    return { horas: 0, minutos: 0, total: '0h 0m' };
  }

  const [entradaH, entradaM] = horaEntrada.split(':').map(Number);
  const [salidaH, salidaM] = horaSalida.split(':').map(Number);

  let minutosTotales = (salidaH * 60 + salidaM) - (entradaH * 60 + entradaM);
  
  // Si la salida es al día siguiente (pasó medianoche)
  if (minutosTotales < 0) {
    minutosTotales += 24 * 60;
  }

  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;

  return {
    horas,
    minutos,
    total: `${horas}h ${minutos}m`
  };
};

/**
 * Obtener ubicación GPS actual del navegador
 * @returns {Promise<Object>} { latitud, longitud }
 */
export const obtenerUbicacionActual = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada por el navegador'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          precision: position.coords.accuracy
        });
      },
      (error) => {
        let mensaje = 'Error obteniendo ubicación';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            mensaje = 'Permiso de ubicación denegado. Active el GPS e intente nuevamente.';
            break;
          case error.POSITION_UNAVAILABLE:
            mensaje = 'Ubicación no disponible. Verifique que el GPS esté activado.';
            break;
          case error.TIMEOUT:
            mensaje = 'Tiempo de espera agotado al obtener ubicación.';
            break;
          default:
            mensaje = 'Error desconocido al obtener ubicación.';
        }
        reject(new Error(mensaje));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

export default {
  registrarCheckIn,
  registrarCheckOut,
  listarAsistenciasPorProfesional,
  obtenerDetalleAsistencia,
  obtenerAsistenciaActiva,
  formatearFecha,
  formatearHora,
  calcularHorasTrabajadas,
  obtenerUbicacionActual
};
