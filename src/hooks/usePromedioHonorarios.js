import { useState, useEffect, useCallback } from 'react';
import { ROLES_ENUM } from '../constants/rolesProfesionales';

/**
 * Hook personalizado para manejar el autocompletado de honorarios basado en promedios
 * de profesionales por rol/rubro
 */
export const usePromedioHonorarios = (empresaId) => {
  const [listaProfesionales, setListaProfesionales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar lista de profesionales
  useEffect(() => {
    if (!empresaId) return;
    
    setLoading(true);
    fetch(`http://localhost:8080/api/profesionales?empresaId=${empresaId}`)
      .then(res => res.json())
      .then(data => {
        const profesionales = Array.isArray(data) ? data : (data?.resultado || data?.data || []);
        setListaProfesionales(profesionales);
        setError(null);
      })
      .catch(error => {
        console.error('❌ Error cargando profesionales:', error);
        setListaProfesionales([]);
        setError('Error al cargar profesionales');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [empresaId]);

  /**
   * Función para calcular promedio de honorarios por rubro y rol
   * @param {string} rubro - Rubro principal (ej: "Plomería", "Electricidad", etc.)
   * @param {string} rol - Rol específico dentro del rubro (ej: "Oficial plomero", "Electricista matriculado", etc.)
   * @returns {Object} { promedio: string, mensaje: string, hayDatos: boolean }
   */
  const calcularPromedioHonorariosPorRubroYRol = useCallback((rubro, rol = '') => {
    if (!listaProfesionales.length) return { promedio: '', mensaje: '', hayDatos: false };
    
    // Normalizar parámetros para comparación flexible
    const rubroNormalizado = rubro ? rubro.trim().toLowerCase() : '';
    const rolNormalizado = (rol || '').trim().toLowerCase();
    
    console.log(`🔍 Buscando promedio para Rubro: "${rubro}" | Rol: "${rol}"`);
    console.log(`📊 Total de profesionales disponibles: ${listaProfesionales.length}`);
    
    // DEBUG: Mostrar todos los profesionales de plomería para análisis
    if (rubroNormalizado.includes('plomer') || rubroNormalizado.includes('plumb')) {
      console.log(`🔧 TODOS los profesionales de PLOMERÍA:`);
      const profesionalesPlomeria = listaProfesionales.filter(prof => {
        const rubroEnBD = (prof.especialidad || prof.rubro || '').trim().toLowerCase();
        const rolEnBD = (prof.tipoProfesional || '').trim().toLowerCase();
        return rubroEnBD.includes('plomer') || rubroEnBD.includes('plumb') || 
               rolEnBD.includes('plomer') || rolEnBD.includes('plumb');
      });
      
      profesionalesPlomeria.forEach((prof, idx) => {
        console.log(`  ${idx + 1}. NOMBRE: "${prof.nombre}" | ROL: "${prof.tipoProfesional}" | RUBRO: "${prof.especialidad || prof.rubro || 'N/A'}" | HONORARIO: ${prof.honorarioDia || prof.valorHoraDefault || prof.honorario || 0}`);
      });
    }
    
    let profesionalesFinales = [];
    
    // ESTRATEGIA 1: Buscar por ROL específico + RUBRO específico
    if (rolNormalizado && rubroNormalizado && rolNormalizado !== ROLES_ENUM.A_DEFINIR.toLowerCase()) {
      
      profesionalesFinales = listaProfesionales.filter(prof => {
        // EN BD: tipo_profesional = ROL, especialidad = RUBRO
        const rolEnBD = (prof.tipoProfesional || '').trim().toLowerCase();  // Este es el ROL
        const rubroEnBD = (prof.especialidad || prof.rubro || '').trim().toLowerCase();  // Este es el RUBRO
        
        // Normalizar variaciones comunes de rubros
        const rubroNormalizadoVariaciones = rubroNormalizado
          .replace(/ía$/i, 'ia')  // Plomería -> Plomeria
          .replace(/ia$/i, '')     // Plomeria -> Plomer
          .replace(/o$/i, '');     // Plomero -> Plomer
        
        const rubroEnBDVariaciones = rubroEnBD
          .replace(/ía$/i, 'ia')
          .replace(/ia$/i, '')
          .replace(/o$/i, '');
        
        // Buscar coincidencia de ROL
        const coincideRol = rolEnBD.includes(rolNormalizado) || 
                           rolNormalizado.includes(rolEnBD) ||
                           rolEnBD === rolNormalizado;
        
        // Buscar coincidencia de RUBRO (con variaciones flexibles)
        const coincideRubro = 
          // Coincidencia directa
          rubroEnBD.includes(rubroNormalizado) || 
          rubroNormalizado.includes(rubroEnBD) ||
          rubroEnBD === rubroNormalizado ||
          // Coincidencia por raíz (Plomeria, Plomero, Plomer coinciden)
          rubroEnBDVariaciones.includes(rubroNormalizadoVariaciones) ||
          rubroNormalizadoVariaciones.includes(rubroEnBDVariaciones) ||
          rubroEnBDVariaciones === rubroNormalizadoVariaciones;
        
        if (coincideRol || coincideRubro) {
          console.log(`  🔍 Profesional: "${prof.nombre}" | ROL: "${prof.tipoProfesional}" | RUBRO: "${prof.especialidad || prof.rubro}" | Coincide ROL: ${coincideRol} | Coincide RUBRO: ${coincideRubro}`);
        }
        
        return coincideRol && coincideRubro;
      });
      
      console.log(`🎯 Búsqueda por ROL "${rol}" + RUBRO "${rubro}": encontrados ${profesionalesFinales.length} profesionales`);
    }
    
    // ESTRATEGIA 2 Y 3 DESHABILITADAS - Solo buscar por ROL + RUBRO exacto
    // Si no hay coincidencia exacta, el campo queda vacío para ingreso manual
    
    const profesionalesConRol = profesionalesFinales;
    
    // Si no encuentra nada con ninguna estrategia, retornar mensaje de aviso
    if (profesionalesConRol.length === 0) {
      console.log(`❌ No se encontraron profesionales para la combinación: Rubro="${rubro}" | Rol="${rol}"`);
      
      // Debug: mostrar algunos profesionales disponibles para ayudar
      console.log(`🔎 Profesionales disponibles (primeros 5):`);
      listaProfesionales.slice(0, 5).forEach((prof, idx) => {
        console.log(`  ${idx + 1}. ROL: "${prof.tipoProfesional}" | RUBRO: "${prof.especialidad || prof.rubro || 'N/A'}" | honorario: ${prof.honorarioDia || prof.valorHoraDefault || prof.honorario || 0}`);
      });
      
      let mensajeAviso = '';
      if (rolNormalizado && rolNormalizado !== ROLES_ENUM.A_DEFINIR.toLowerCase() && rubroNormalizado) {
        mensajeAviso = `No hay datos de "${rol}" en "${rubro}". Ingrese el valor manualmente.`;
      } else if (rubroNormalizado) {
        mensajeAviso = `No hay profesionales registrados en "${rubro}". Ingrese el valor manualmente.`;
      } else if (rolNormalizado && rolNormalizado !== ROLES_ENUM.A_DEFINIR.toLowerCase()) {
        mensajeAviso = `No hay datos para el rol "${rol}". Ingrese el valor manualmente.`;
      }
      
      return { 
        promedio: '', 
        mensaje: mensajeAviso, 
        hayDatos: false 
      };
    }
    
    console.log(`📋 PROFESIONALES SELECCIONADOS PARA EL CÁLCULO:`);
    profesionalesConRol.forEach((prof, idx) => {
      const honorarioUsado = prof.honorarioDia || prof.valorHoraDefault || prof.honorario || 0;
      console.log(`  ${idx + 1}. "${prof.nombre}" | ROL: "${prof.tipoProfesional}" | RUBRO: "${prof.especialidad || prof.rubro}" | HONORARIO USADO: ${honorarioUsado}`);
      console.log(`       honorarioDia: ${prof.honorarioDia || 'N/A'} | valorHoraDefault: ${prof.valorHoraDefault || 'N/A'} | honorario: ${prof.honorario || 'N/A'}`);
    });
    
    // Calcular promedio de honorarios
    const sumaHonorarios = profesionalesConRol.reduce((sum, prof) => {
      const honorario = parseFloat(prof.honorarioDia || prof.valorHoraDefault || prof.honorario || 0);
      console.log(`  💰 Sumando: ${honorario} (de ${prof.nombre})`);
      return sum + honorario;
    }, 0);
    
    const promedio = sumaHonorarios / profesionalesConRol.length;
    
    console.log(`🧮 CÁLCULO DETALLADO:`);
    console.log(`  Suma total: ${sumaHonorarios}`);
    console.log(`  Cantidad profesionales: ${profesionalesConRol.length}`);
    console.log(`  Promedio: ${sumaHonorarios} ÷ ${profesionalesConRol.length} = ${promedio}`);
    console.log(`  Promedio redondeado: ${promedio.toFixed(2)}`);
    
    console.log(`💰 PROMEDIO CALCULADO:`, {
      busqueda: `Rubro: "${rubro}" > Rol: "${rol}"`,
      profesionalesEncontrados: profesionalesConRol.length,
      sumaHonorarios: sumaHonorarios.toFixed(2),
      promedioCalculado: promedio.toFixed(2),
      estrategiaUsada: rolNormalizado && rubroNormalizado && rolNormalizado !== ROLES_ENUM.A_DEFINIR.toLowerCase() ? 'ROL COMPLETO + RUBRO' : 'FALLBACK',
      profesionalesDetalle: profesionalesConRol.map(p => ({ 
        nombre: p.nombre, 
        rol: p.tipoProfesional,        // EN BD: tipo_profesional = ROL
        rubro: p.especialidad || p.rubro, // EN BD: especialidad = RUBRO
        honorarioDia: p.honorarioDia,
        valorHoraDefault: p.valorHoraDefault,
        honorario: p.honorario,
        honorarioUsado: p.honorarioDia || p.valorHoraDefault || p.honorario
      }))
    });
    
    return promedio > 0 ? promedio.toFixed(2) : '';
  }, [listaProfesionales]);

  /**
   * Función EXTENDIDA que devuelve promedio + mensaje + indicador de datos
   * Úsala cuando necesites mostrar avisos al usuario
   * @param {string} rubro - Rubro principal
   * @param {string} rol - Rol específico
   * @returns {Object} { promedio: string, mensaje: string, hayDatos: boolean }
   */
  const calcularPromedioConMensaje = useCallback((rubro, rol = '') => {
    const promedio = calcularPromedioHonorariosPorRubroYRol(rubro, rol);
    
    if (!promedio) {
      // No hay datos - generar mensaje de aviso
      const rubroNormalizado = rubro ? rubro.trim().toLowerCase() : '';
      const rolNormalizado = (rol || '').trim().toLowerCase();
      
      let mensajeAviso = '';
      if (rolNormalizado && rolNormalizado !== ROLES_ENUM.A_DEFINIR.toLowerCase() && rubroNormalizado) {
        mensajeAviso = `No hay datos de "${rol}" en "${rubro}". Ingrese el valor manualmente.`;
      } else if (rubroNormalizado) {
        mensajeAviso = `No hay profesionales registrados en "${rubro}". Ingrese el valor manualmente.`;
      } else if (rolNormalizado && rolNormalizado !== ROLES_ENUM.A_DEFINIR.toLowerCase()) {
        mensajeAviso = `No hay datos para el rol "${rol}". Ingrese el valor manualmente.`;
      }
      
      return {
        promedio: '',
        mensaje: mensajeAviso,
        hayDatos: false
      };
    }
    
    // Hay datos - devolver con mensaje informativo
    return {
      promedio: promedio,
      mensaje: `Promedio calculado automáticamente`,
      hayDatos: true
    };
  }, [calcularPromedioHonorariosPorRubroYRol]);
  
  const [profesionalesCalc, setProfesionalesCalc] = useState([]);

  /**
   * Función para obtener rubros únicos disponibles
   * @returns {Array} Lista de rubros únicos
   */
  const getRubrosDisponibles = useCallback(() => {
    const rubros = new Set();
    listaProfesionales.forEach(prof => {
      if (prof.especialidad) {
        rubros.add(prof.especialidad.trim());
      }
      if (prof.rubro) {
        rubros.add(prof.rubro.trim());
      }
    });
    return Array.from(rubros).sort();
  }, [listaProfesionales]);

  /**
   * Función para obtener roles únicos dentro de un rubro específico
   * @param {string} rubro - Rubro para filtrar roles
   * @returns {Array} Lista de roles únicos dentro del rubro
   */
  const getRolesPorRubro = useCallback((rubro) => {
    if (!rubro) return [];
    
    const rubroNormalizado = rubro.trim().toLowerCase();
    const roles = new Set();
    
    listaProfesionales.forEach(prof => {
      // EN BD: especialidad = RUBRO, tipoProfesional = ROL
      const rubroEnBD = (prof.especialidad || prof.rubro || '').trim().toLowerCase();
      const rolEnBD = (prof.tipoProfesional || '').trim().toLowerCase();
      
      // Si el profesional pertenece al rubro, agregar su rol
      if (rubroEnBD.includes(rubroNormalizado) || 
          rubroNormalizado.includes(rubroEnBD) ||
          rubroEnBD === rubroNormalizado) {
        
        if (prof.tipoProfesional) {
          roles.add(prof.tipoProfesional.trim()); // Agregar el ROL
        }
      }
    });
    
    return Array.from(roles).sort();
  }, [listaProfesionales]);

  return {
    listaProfesionales,
    loading,
    error,
    calcularPromedioHonorariosPorRubroYRol,
    getRubrosDisponibles,
    getRolesPorRubro
  };
};

export default usePromedioHonorarios;