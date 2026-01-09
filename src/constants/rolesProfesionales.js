/**
 * Enum centralizado para roles de profesionales
 * Este archivo define los roles disponibles en todo el sistema
 */

export const ROLES_PROFESIONALES = [
  'A Definir',      // Valor por defecto
  'Oficial',        // Más usado
  'Ayudante',       // Asistente
  'Medio Oficial'   // Nivel intermedio
];

/**
 * Objeto para facilitar validaciones y comparaciones
 */
export const ROLES_ENUM = {
  A_DEFINIR: 'A Definir',
  OFICIAL: 'Oficial',
  AYUDANTE: 'Ayudante',
  MEDIO_OFICIAL: 'Medio Oficial'
};

/**
 * Función para validar si un rol es válido
 * @param {string} rol - Rol a validar
 * @returns {boolean} - True si es válido
 */
export const esRolValido = (rol) => {
  return ROLES_PROFESIONALES.includes(rol);
};

/**
 * Función para obtener el rol por defecto
 * @returns {string} - Rol por defecto
 */
export const getRolPorDefecto = () => {
  return ROLES_ENUM.A_DEFINIR;
};

/**
 * Función para generar opciones para selectores HTML
 * @param {string} gentilicio - Gentilicio del rubro (opcional)
 * @returns {Array} - Array de objetos {value, label}
 */
export const generarOpcionesRoles = (gentilicio = '') => {
  return ROLES_PROFESIONALES.map(rol => {
    const valor = rol;
    const etiqueta = (gentilicio && rol !== ROLES_ENUM.A_DEFINIR)
      ? `${rol} ${gentilicio}`
      : rol;

    return {
      value: valor,
      label: etiqueta
    };
  });
};
