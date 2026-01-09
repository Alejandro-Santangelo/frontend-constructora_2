import tiposProfesionalesData from '../data/tiposProfesionales.json';

// Lista de profesionales conocidos
let tiposProfesionales = [...tiposProfesionalesData.tiposProfesionales];

/**
 * Calcula la similitud entre dos strings usando distancia de Levenshtein simplificada
 * Retorna un valor entre 0 (completamente diferente) y 1 (idéntico)
 */
const calcularSimilitud = (str1, str2) => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // Si uno contiene al otro, alta similitud
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }
  
  // Similitud por palabras comunes
  const palabras1 = s1.split(/\s+/);
  const palabras2 = s2.split(/\s+/);
  
  let palabrasComunes = 0;
  palabras1.forEach(p1 => {
    if (palabras2.some(p2 => p2.includes(p1) || p1.includes(p2))) {
      palabrasComunes++;
    }
  });
  
  if (palabrasComunes > 0) {
    return palabrasComunes / Math.max(palabras1.length, palabras2.length);
  }
  
  // Distancia de Levenshtein simplificada
  const maxLen = Math.max(s1.length, s2.length);
  let diferencias = 0;
  
  for (let i = 0; i < maxLen; i++) {
    if (s1[i] !== s2[i]) diferencias++;
  }
  
  return 1 - (diferencias / maxLen);
};

/**
 * Verifica si un texto se parece a un tipo de profesional
 * @param {string} texto - El texto a verificar
 * @param {number} umbralSimilitud - Umbral de similitud (0-1). Por defecto 0.6
 * @returns {Object} { esProfesional: boolean, profesionalSimilar: string|null, similitud: number }
 */
export const verificarSiEsProfesional = (texto, umbralSimilitud = 0.6) => {
  if (!texto || typeof texto !== 'string') {
    return { esProfesional: false, profesionalSimilar: null, similitud: 0 };
  }
  
  const textoNormalizado = texto.trim();
  
  // Buscar coincidencia exacta
  const coincidenciaExacta = tiposProfesionales.find(
    tipo => tipo.toLowerCase() === textoNormalizado.toLowerCase()
  );
  
  if (coincidenciaExacta) {
    return { 
      esProfesional: true, 
      profesionalSimilar: coincidenciaExacta, 
      similitud: 1 
    };
  }
  
  // Buscar por similitud
  let mejorCoincidencia = null;
  let mejorSimilitud = 0;
  
  tiposProfesionales.forEach(tipo => {
    const similitud = calcularSimilitud(textoNormalizado, tipo);
    if (similitud > mejorSimilitud) {
      mejorSimilitud = similitud;
      mejorCoincidencia = tipo;
    }
  });
  
  if (mejorSimilitud >= umbralSimilitud) {
    return {
      esProfesional: true,
      profesionalSimilar: mejorCoincidencia,
      similitud: mejorSimilitud
    };
  }
  
  return { 
    esProfesional: false, 
    profesionalSimilar: mejorCoincidencia, 
    similitud: mejorSimilitud 
  };
};

/**
 * Agrega un nuevo tipo de profesional a la lista
 * @param {string} nuevoProfesional 
 */
export const agregarNuevoProfesional = (nuevoProfesional) => {
  const profesionalNormalizado = nuevoProfesional.trim();
  
  // Verificar si ya existe
  const existe = tiposProfesionales.some(
    tipo => tipo.toLowerCase() === profesionalNormalizado.toLowerCase()
  );
  
  if (!existe) {
    tiposProfesionales.push(profesionalNormalizado);
    console.log(`✅ Nuevo tipo de profesional agregado: ${profesionalNormalizado}`);
    return true;
  }
  
  return false;
};

/**
 * Obtiene la lista actual de tipos de profesionales
 */
export const obtenerTiposProfesionales = () => {
  return [...tiposProfesionales];
};

/**
 * Valida si un ítem debe ir en materiales o profesionales
 * @param {string} nombreItem - Nombre del ítem a validar
 * @param {string} tipoEsperado - 'material' o 'profesional'
 * @returns {Object} { esValido: boolean, mensaje: string, sugerencia: string|null }
 */
export const validarTipoItem = (nombreItem, tipoEsperado) => {
  // Lista de palabras clave que identifican claramente materiales
  const palabrasClavesMateriales = [
    /\bbolsa[s]?\b/i,      // bolsa, bolsas
    /\bkg\b/i,             // kilogramos
    /\bm[23]?\b/i,         // metros, m2, m3
    /\blitro[s]?\b/i,      // litro, litros
    /\bunidad(es)?\b/i,    // unidad, unidades
    /\bcaja[s]?\b/i,       // caja, cajas
    /\bpaquete[s]?\b/i,    // paquete, paquetes
    /\bsaco[s]?\b/i,       // saco, sacos
    /\bbidon(es)?\b/i,     // bidon, bidones
    /\bbarril(es)?\b/i,    // barril, barriles
    /\bpaleta[s]?\b/i,     // paleta, paletas (de material)
  ];
  
  // Si es un material esperado, verificar si contiene palabras clave de materiales
  if (tipoEsperado === 'material') {
    const esMaterialPorPalabra = palabrasClavesMateriales.some(regex => regex.test(nombreItem));
    if (esMaterialPorPalabra) {
      return {
        esValido: true,
        mensaje: '✅ Material identificado correctamente',
        sugerencia: null,
        similitud: 0
      };
    }
  }
  
  const resultado = verificarSiEsProfesional(nombreItem);
  
  if (tipoEsperado === 'material' && resultado.esProfesional) {
    return {
      esValido: false,
      mensaje: `⚠️ "${nombreItem}" parece ser un tipo de profesional (similar a "${resultado.profesionalSimilar}"). 
Por favor, usa el campo de PROFESIONALES para agregarlo.`,
      sugerencia: resultado.profesionalSimilar,
      similitud: resultado.similitud
    };
  }
  
  if (tipoEsperado === 'profesional' && !resultado.esProfesional && resultado.similitud < 0.3) {
    // Si la similitud es muy baja, probablemente sea un material
    return {
      esValido: false,
      mensaje: `⚠️ "${nombreItem}" no parece ser un tipo de profesional conocido. 
¿Estás seguro de que no es un material? Si es correcto, se agregará como nuevo tipo de profesional.`,
      sugerencia: null,
      similitud: resultado.similitud
    };
  }
  
  return {
    esValido: true,
    mensaje: '✅ Validación correcta',
    sugerencia: null,
    similitud: resultado.similitud
  };
};

export default {
  verificarSiEsProfesional,
  agregarNuevoProfesional,
  obtenerTiposProfesionales,
  validarTipoItem
};
