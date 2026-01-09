/**
 * Retorna la clase de Bootstrap para el badge según el tipo de profesional o rubro
 * Agrupa los colores por categorías relacionadas
 */
export const getTipoProfesionalBadgeClass = (tipo) => {
  if (!tipo) return 'bg-secondary';
  
  const tipoNormalizado = tipo.toUpperCase().trim();
  
  // 1. Albañilería y mampostería - marrón/naranja
  if (tipoNormalizado.includes('ALBAÑIL') || 
      tipoNormalizado.includes('AYUDANTE ALBAÑIL') ||
      tipoNormalizado.includes('OFICIAL ALBAÑIL') ||
      tipoNormalizado.includes('PEÓN') ||
      tipoNormalizado.includes('MAMPOSTERO') ||
      tipoNormalizado.includes('LADRILLERO') ||
      tipoNormalizado.includes('BLOQUERO')) {
    return 'bg-warning text-dark';
  }
  
  // 2. Electricidad - azul claro
  if (tipoNormalizado.includes('ELECTRIC') || 
      tipoNormalizado.includes('ELÉCTRIC') ||
      tipoNormalizado.includes('OFICIAL ELECTRICISTA') ||
      tipoNormalizado.includes('AYUDANTE ELECTRICISTA')) {
    return 'bg-info text-dark';
  }
  
  // 3. Plomería y sanitarios - azul oscuro
  if (tipoNormalizado.includes('PLOMERO') || 
      tipoNormalizado.includes('PLOMERÍA') ||
      tipoNormalizado.includes('GASISTA') ||
      tipoNormalizado.includes('GASFITER') ||
      tipoNormalizado.includes('SANITARIO') ||
      tipoNormalizado.includes('CLOACA') ||
      tipoNormalizado.includes('OFICIAL PLOMERO') ||
      tipoNormalizado.includes('AYUDANTE PLOMERO')) {
    return 'bg-primary';
  }
  
  // 4. Pintura y acabados - rojo
  if (tipoNormalizado.includes('PINTOR') || 
      tipoNormalizado.includes('PINTURA') ||
      tipoNormalizado.includes('OFICIAL PINTOR') ||
      tipoNormalizado.includes('AYUDANTE PINTOR')) {
    return 'bg-danger';
  }
  
  // 5. Revoques y enlucidos - rosa/fucsia
  if (tipoNormalizado.includes('REVOCADOR') ||
      tipoNormalizado.includes('REVOQUE') ||
      tipoNormalizado.includes('YESERO') ||
      tipoNormalizado.includes('YESERÍA') ||
      tipoNormalizado.includes('ENDUIDOR') ||
      tipoNormalizado.includes('ESTUCADOR')) {
    return 'text-bg-danger bg-opacity-75';
  }
  
  // 6. Carpintería - marrón oscuro
  if (tipoNormalizado.includes('CARPINTERO') || 
      tipoNormalizado.includes('CARPINTERÍA') ||
      tipoNormalizado.includes('EBANISTA') ||
      tipoNormalizado.includes('OFICIAL CARPINTERO') ||
      tipoNormalizado.includes('AYUDANTE CARPINTERO')) {
    return 'bg-dark text-white';
  }
  
  // 7. Herrería y metales - gris oscuro
  if (tipoNormalizado.includes('HERRERO') ||
      tipoNormalizado.includes('HERRERÍA') ||
      tipoNormalizado.includes('SOLDADOR') ||
      tipoNormalizado.includes('METALÚRGICO') ||
      tipoNormalizado.includes('OFICIAL HERRERO')) {
    return 'bg-secondary text-white';
  }
  
  // 8. Arquitectos - verde oscuro
  if (tipoNormalizado.includes('ARQUITECTO')) {
    return 'bg-success text-white';
  }
  
  // 9. Ingenieros - verde claro
  if (tipoNormalizado.includes('INGENIERO')) {
    return 'text-bg-success bg-opacity-75';
  }
  
  // 10. Maestro mayor de obras - verde medio
  if (tipoNormalizado.includes('MAESTRO MAYOR') ||
      tipoNormalizado.includes('MMO')) {
    return 'bg-success bg-opacity-50 text-dark';
  }
  
  // 11. Técnicos - teal
  if (tipoNormalizado.includes('TÉCNICO') ||
      tipoNormalizado.includes('TECNICO') ||
      tipoNormalizado.includes('PROYECTISTA')) {
    return 'bg-info bg-opacity-50 text-dark';
  }
  
  // 12. Supervisión y dirección - púrpura
  if (tipoNormalizado.includes('SUPERVISOR') || 
      tipoNormalizado.includes('CAPATAZ') ||
      tipoNormalizado.includes('ENCARGADO') ||
      tipoNormalizado.includes('DIRECTOR') ||
      tipoNormalizado.includes('JEFE DE OBRA')) {
    return 'text-bg-primary bg-opacity-50';
  }
  
  // 13. Vidrios y aberturas - celeste
  if (tipoNormalizado.includes('VIDRIERO') || 
      tipoNormalizado.includes('ABERTURAS') ||
      tipoNormalizado.includes('VENTANAS') ||
      tipoNormalizado.includes('ALUMINIO')) {
    return 'bg-info bg-opacity-25 text-dark';
  }
  
  // 14. Climatización - cyan
  if (tipoNormalizado.includes('CLIMATIZACIÓN') || 
      tipoNormalizado.includes('AIRE ACONDICIONADO') ||
      tipoNormalizado.includes('REFRIGERACIÓN') ||
      tipoNormalizado.includes('CALEFACCIÓN') ||
      tipoNormalizado.includes('HVAC')) {
    return 'bg-primary bg-opacity-25 text-dark';
  }
  
  // 15. Pisos y solados - beige/amarillo pálido
  if (tipoNormalizado.includes('SOLADOR') || 
      tipoNormalizado.includes('CERAMISTA') ||
      tipoNormalizado.includes('PISO') ||
      tipoNormalizado.includes('MOSAIQUISTA') ||
      tipoNormalizado.includes('OFICIAL SOLADOR')) {
    return 'bg-warning bg-opacity-25 text-dark';
  }
  
  // 16. Mármol y piedra - gris claro
  if (tipoNormalizado.includes('MARMOLERO') ||
      tipoNormalizado.includes('MARMOLISTA') ||
      tipoNormalizado.includes('GRANITERO') ||
      tipoNormalizado.includes('CANTERO')) {
    return 'bg-secondary bg-opacity-25 text-dark';
  }
  
  // 17. Revestimientos - naranja pálido
  if (tipoNormalizado.includes('REVESTIDOR') ||
      tipoNormalizado.includes('REVESTIMIENTO') ||
      tipoNormalizado.includes('ENCHAPADOR') ||
      tipoNormalizado.includes('VENECITA')) {
    return 'bg-warning bg-opacity-50 text-dark';
  }
  
  // 18. Techos y cubiertas - azul grisáceo
  if (tipoNormalizado.includes('TECHISTA') ||
      tipoNormalizado.includes('CHAPISTA') ||
      tipoNormalizado.includes('CUBIERTA') ||
      tipoNormalizado.includes('MEMBRANA') ||
      tipoNormalizado.includes('IMPERMEABILIZADOR')) {
    return 'bg-primary bg-opacity-50 text-white';
  }
  
  // 19. Jardinería y paisajismo - verde brillante
  if (tipoNormalizado.includes('JARDINERO') ||
      tipoNormalizado.includes('PAISAJISTA') ||
      tipoNormalizado.includes('PARQUISTA')) {
    return 'text-bg-success';
  }
  
  // 20. Demolición y excavación - gris muy oscuro
  if (tipoNormalizado.includes('DEMOLEDOR') ||
      tipoNormalizado.includes('EXCAVADOR') ||
      tipoNormalizado.includes('OPERADOR') ||
      tipoNormalizado.includes('MAQUINISTA')) {
    return 'bg-dark bg-opacity-75 text-white';
  }
  
  // 21. Instalaciones especiales - violeta
  if (tipoNormalizado.includes('DOMÓTICA') ||
      tipoNormalizado.includes('AUTOMATIZACIÓN') ||
      tipoNormalizado.includes('SEGURIDAD') ||
      tipoNormalizado.includes('ALARMAS') ||
      tipoNormalizado.includes('CCTV')) {
    return 'text-bg-secondary bg-opacity-50';
  }
  
  // 22. Aislación - celeste pálido
  if (tipoNormalizado.includes('AISLACIÓN') ||
      tipoNormalizado.includes('AISLANTE') ||
      tipoNormalizado.includes('DURLOCK') ||
      tipoNormalizado.includes('DRYWALL')) {
    return 'bg-info bg-opacity-10 text-dark';
  }
  
  // Por defecto - gris medio
  return 'bg-secondary';
};

/**
 * Retorna el color en formato hex para usar en estilos inline
 */
export const getTipoProfesionalColor = (tipo) => {
  const badgeClass = getTipoProfesionalBadgeClass(tipo);
  
  const colorMap = {
    'bg-warning text-dark': '#ffc107',
    'bg-info text-dark': '#0dcaf0',
    'bg-primary': '#0d6efd',
    'bg-danger': '#dc3545',
    'text-bg-danger bg-opacity-75': '#dc3545',
    'bg-dark text-white': '#212529',
    'bg-secondary text-white': '#6c757d',
    'bg-success text-white': '#198754',
    'text-bg-success bg-opacity-75': '#198754',
    'bg-success bg-opacity-50 text-dark': '#198754',
    'bg-info bg-opacity-50 text-dark': '#0dcaf0',
    'text-bg-primary bg-opacity-50': '#0d6efd',
    'bg-info bg-opacity-25 text-dark': '#0dcaf0',
    'bg-primary bg-opacity-25 text-dark': '#0d6efd',
    'bg-warning bg-opacity-25 text-dark': '#ffc107',
    'bg-secondary bg-opacity-25 text-dark': '#6c757d',
    'bg-warning bg-opacity-50 text-dark': '#ffc107',
    'bg-primary bg-opacity-50 text-white': '#0d6efd',
    'text-bg-success': '#198754',
    'bg-dark bg-opacity-75 text-white': '#212529',
    'text-bg-secondary bg-opacity-50': '#6c757d',
    'bg-info bg-opacity-10 text-dark': '#0dcaf0',
    'bg-secondary': '#6c757d'
  };
  
  return colorMap[badgeClass] || '#6c757d';
};

/**
 * Retorna un número de prioridad para ordenar por grupo de rubro
 * Menor número = aparece primero
 */
const getPrioridadRubro = (tipo) => {
  if (!tipo) return 999;
  
  const tipoNormalizado = tipo.toUpperCase().trim();
  
  // 1. Profesionales técnicos (arquitectos, ingenieros)
  if (tipoNormalizado.includes('ARQUITECTO')) return 1;
  if (tipoNormalizado.includes('INGENIERO')) return 2;
  if (tipoNormalizado.includes('MAESTRO MAYOR')) return 3;
  if (tipoNormalizado.includes('TÉCNICO') || tipoNormalizado.includes('TECNICO')) return 4;
  
  // 2. Supervisión
  if (tipoNormalizado.includes('SUPERVISOR') || 
      tipoNormalizado.includes('CAPATAZ') ||
      tipoNormalizado.includes('ENCARGADO') ||
      tipoNormalizado.includes('DIRECTOR') ||
      tipoNormalizado.includes('JEFE')) return 5;
  
  // 3. Albañilería (más común)
  if (tipoNormalizado.includes('ALBAÑIL') || 
      tipoNormalizado.includes('AYUDANTE ALBAÑIL') ||
      tipoNormalizado.includes('OFICIAL ALBAÑIL') ||
      tipoNormalizado.includes('PEÓN') ||
      tipoNormalizado.includes('MAMPOSTERO') ||
      tipoNormalizado.includes('LADRILLERO') ||
      tipoNormalizado.includes('BLOQUERO')) return 10;
  
  // 4. Electricidad
  if (tipoNormalizado.includes('ELECTRIC') || tipoNormalizado.includes('ELÉCTRIC')) return 20;
  
  // 5. Plomería
  if (tipoNormalizado.includes('PLOMERO') || 
      tipoNormalizado.includes('PLOMERÍA') ||
      tipoNormalizado.includes('GASISTA') ||
      tipoNormalizado.includes('SANITARIO')) return 30;
  
  // 6. Pintura
  if (tipoNormalizado.includes('PINTOR') || tipoNormalizado.includes('PINTURA')) return 40;
  
  // 7. Revoques
  if (tipoNormalizado.includes('REVOCADOR') ||
      tipoNormalizado.includes('REVOQUE') ||
      tipoNormalizado.includes('YESERO') ||
      tipoNormalizado.includes('ENDUIDOR')) return 45;
  
  // 8. Carpintería
  if (tipoNormalizado.includes('CARPINTERO') || tipoNormalizado.includes('CARPINTERÍA')) return 50;
  
  // 9. Herrería
  if (tipoNormalizado.includes('HERRERO') || tipoNormalizado.includes('HERRERÍA') || tipoNormalizado.includes('SOLDADOR')) return 55;
  
  // 10. Pisos
  if (tipoNormalizado.includes('SOLADOR') || 
      tipoNormalizado.includes('CERAMISTA') ||
      tipoNormalizado.includes('PISO') ||
      tipoNormalizado.includes('MOSAIQUISTA')) return 60;
  
  // 11. Revestimientos
  if (tipoNormalizado.includes('REVESTIDOR') || tipoNormalizado.includes('REVESTIMIENTO')) return 65;
  
  // 12. Mármol
  if (tipoNormalizado.includes('MARMOLERO') || tipoNormalizado.includes('MARMOLISTA')) return 70;
  
  // 13. Vidrios
  if (tipoNormalizado.includes('VIDRIERO') || tipoNormalizado.includes('ABERTURAS')) return 75;
  
  // 14. Techos
  if (tipoNormalizado.includes('TECHISTA') || tipoNormalizado.includes('CHAPISTA')) return 80;
  
  // 15. Climatización
  if (tipoNormalizado.includes('CLIMATIZACIÓN') || tipoNormalizado.includes('AIRE ACONDICIONADO')) return 85;
  
  // 16. Jardinería
  if (tipoNormalizado.includes('JARDINERO') || tipoNormalizado.includes('PAISAJISTA')) return 90;
  
  // 17. Demolición
  if (tipoNormalizado.includes('DEMOLEDOR') || tipoNormalizado.includes('EXCAVADOR')) return 95;
  
  // 18. Otros
  return 100;
};

/**
 * Ordena un array de profesionales agrupándolos por rubro/color
 * @param {Array} profesionales - Array de objetos con propiedad tipoProfesional
 * @returns {Array} Array ordenado por rubro
 */
export const ordenarPorRubro = (profesionales) => {
  if (!Array.isArray(profesionales)) return [];
  
  return [...profesionales].sort((a, b) => {
    const prioridadA = getPrioridadRubro(a.tipoProfesional);
    const prioridadB = getPrioridadRubro(b.tipoProfesional);
    
    // Primero ordenar por prioridad de rubro
    if (prioridadA !== prioridadB) {
      return prioridadA - prioridadB;
    }
    
    // Dentro del mismo rubro, ordenar por tipo profesional alfabéticamente
    const tipoA = (a.tipoProfesional || '').toUpperCase();
    const tipoB = (b.tipoProfesional || '').toUpperCase();
    if (tipoA !== tipoB) {
      return tipoA.localeCompare(tipoB);
    }
    
    // Si es el mismo tipo, ordenar por nombre
    const nombreA = (a.nombreProfesional || a.nombre || '').toUpperCase();
    const nombreB = (b.nombreProfesional || b.nombre || '').toUpperCase();
    return nombreA.localeCompare(nombreB);
  });
};
