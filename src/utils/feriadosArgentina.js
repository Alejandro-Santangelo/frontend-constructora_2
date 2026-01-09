/**
 * 📅 Calendario de Feriados Nacionales Argentina 2025-2026
 * Fuente: Decreto Nacional de Feriados
 */

export const FERIADOS_ARGENTINA = [
  // 2025
  '2025-01-01', // Año Nuevo
  '2025-02-24', // Carnaval
  '2025-02-25', // Carnaval
  '2025-03-24', // Día Nacional de la Memoria
  '2025-04-02', // Día del Veterano
  '2025-04-17', // Jueves Santo (puente)
  '2025-04-18', // Viernes Santo
  '2025-05-01', // Día del Trabajador
  '2025-05-25', // Revolución de Mayo
  '2025-06-16', // Día de Güemes
  '2025-06-20', // Día de la Bandera
  '2025-07-09', // Día de la Independencia
  '2025-08-15', // Paso a la Inmortalidad del Gral. San Martín (puente)
  '2025-08-17', // Paso a la Inmortalidad del Gral. San Martín
  '2025-10-12', // Día del Respeto a la Diversidad Cultural (puente)
  '2025-10-13', // Día del Respeto a la Diversidad Cultural
  '2025-11-24', // Día de la Soberanía Nacional
  '2025-12-08', // Inmaculada Concepción
  '2025-12-25', // Navidad
  
  // 2026
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-24', // Día Nacional de la Memoria
  '2026-04-02', // Día del Veterano
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-25', // Revolución de Mayo
  '2026-06-15', // Día de Güemes (puente)
  '2026-06-20', // Día de la Bandera
  '2026-07-09', // Día de la Independencia
  '2026-08-17', // Paso a la Inmortalidad del Gral. San Martín
  '2026-10-12', // Día del Respeto a la Diversidad Cultural
  '2026-11-23', // Día de la Soberanía Nacional (puente)
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

/**
 * Convierte una fecha a formato YYYY-MM-DD usando zona horaria local
 * (Evita problemas de offset UTC al trabajar con fechas en formato string)
 * @param {Date|string} fecha - Fecha a convertir
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const formatearFechaLocal = (fecha) => {
  let date;
  
  if (fecha instanceof Date) {
    date = fecha;
  } else if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    // Si es formato YYYY-MM-DD, parsearlo como fecha local
    const [year, month, day] = fecha.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(fecha);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Verifica si una fecha es feriado nacional
 * @param {Date|string} fecha - Fecha a verificar
 * @returns {boolean} true si es feriado
 */
export const esFeriado = (fecha) => {
  const fechaStr = formatearFechaLocal(fecha);
  return FERIADOS_ARGENTINA.includes(fechaStr);
};

/**
 * Verifica si una fecha es día hábil (lun-vie, no feriado)
 * @param {Date|string} fecha - Fecha a verificar
 * @returns {boolean} true si es día hábil
 */
export const esDiaHabil = (fecha) => {
  const date = fecha instanceof Date ? fecha : new Date(fecha);
  const diaSemana = date.getDay();
  
  // 0 = domingo, 6 = sábado
  if (diaSemana === 0 || diaSemana === 6) {
    return false;
  }
  
  // Verificar si es feriado
  return !esFeriado(date);
};

/**
 * Obtiene el siguiente día hábil a partir de una fecha
 * @param {Date|string} fecha - Fecha inicial
 * @returns {Date} Primera fecha hábil encontrada
 */
export const obtenerSiguienteDiaHabil = (fecha) => {
  const date = fecha instanceof Date ? new Date(fecha) : new Date(fecha);
  
  // Avanzar hasta encontrar un día hábil
  while (!esDiaHabil(date)) {
    date.setDate(date.getDate() + 1);
  }
  
  return date;
};

/**
 * Cuenta los días hábiles entre dos fechas
 * @param {Date|string} fechaInicio - Fecha de inicio
 * @param {Date|string} fechaFin - Fecha de fin
 * @returns {number} Cantidad de días hábiles
 */
export const contarDiasHabiles = (fechaInicio, fechaFin) => {
  const inicio = fechaInicio instanceof Date ? new Date(fechaInicio) : new Date(fechaInicio);
  const fin = fechaFin instanceof Date ? new Date(fechaFin) : new Date(fechaFin);
  
  let count = 0;
  const current = new Date(inicio);
  
  while (current <= fin) {
    if (esDiaHabil(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

/**
 * Genera un array de días hábiles entre dos fechas
 * @param {Date|string} fechaInicio - Fecha de inicio
 * @param {Date|string} fechaFin - Fecha de fin
 * @returns {Date[]} Array de fechas hábiles
 */
export const generarDiasHabiles = (fechaInicio, fechaFin) => {
  const inicio = fechaInicio instanceof Date ? new Date(fechaInicio) : new Date(fechaInicio);
  const fin = fechaFin instanceof Date ? new Date(fechaFin) : new Date(fechaFin);
  
  const diasHabiles = [];
  const current = new Date(inicio);
  
  while (current <= fin) {
    if (esDiaHabil(current)) {
      diasHabiles.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return diasHabiles;
};

/**
 * Calcula cuántas semanas se necesitan para completar una cantidad de días hábiles
 * teniendo en cuenta fines de semana y feriados
 * @param {Date|string} fechaInicio - Fecha de inicio
 * @param {number} diasHabilesNecesarios - Cantidad de días hábiles necesarios
 * @returns {number} Cantidad de semanas (redondeado hacia arriba)
 */
export const calcularSemanasParaDiasHabiles = (fechaInicio, diasHabilesNecesarios) => {
  if (!fechaInicio || !diasHabilesNecesarios || diasHabilesNecesarios <= 0) {
    return 0;
  }

  const inicio = fechaInicio instanceof Date ? new Date(fechaInicio) : new Date(fechaInicio);
  let diasHabilesContados = 0;
  const current = new Date(inicio);
  const semanasSet = new Set();

  // Generar días hábiles y contar semanas calendario únicas
  while (diasHabilesContados < diasHabilesNecesarios) {
    if (esDiaHabil(current)) {
      // Calcular el lunes de esta semana
      const diaSemana = current.getDay();
      const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
      const lunes = new Date(current);
      lunes.setDate(lunes.getDate() - diasDesdeElLunes);
      
      // Usar la fecha del lunes (YYYY-MM-DD) como clave única
      const claveSemana = formatearFechaLocal(lunes);
      semanasSet.add(claveSemana);
      
      diasHabilesContados++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return semanasSet.size;
};

/**
 * Calcula cuántas semanas se necesitan para completar una cantidad de días hábiles
 * usando una estimación simple de 5 días hábiles por semana
 * @param {number} diasHabilesNecesarios - Cantidad de días hábiles necesarios
 * @returns {number} Cantidad de semanas (redondeado hacia arriba)
 */
export const convertirDiasHabilesASemanasSimple = (diasHabilesNecesarios) => {
  if (!diasHabilesNecesarios || diasHabilesNecesarios <= 0) {
    return 0;
  }
  
  // 5 días hábiles por semana (lunes a viernes)
  return Math.ceil(diasHabilesNecesarios / 5);
};
