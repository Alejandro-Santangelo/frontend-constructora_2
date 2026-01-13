import { useState, useEffect } from 'react';

/**
 * Hook para detectar el modo de un presupuesto (GLOBAL, DETALLE, MIXTO)
 * basándose en los items de la calculadora
 *
 * @param {Object} presupuesto - Objeto del presupuesto con itemsCalculadora
 * @param {boolean} show - Si el modal/componente está visible
 * @returns {string|null} - 'GLOBAL' | 'DETALLE' | 'MIXTO' | null
 */
export const useDetectarModoPresupuesto = (presupuesto, show = true) => {
  const [modoDetectado, setModoDetectado] = useState(null);

  useEffect(() => {
    if (!show || !presupuesto) {
      setModoDetectado(null);
      return;
    }

    const itemsCalculadora = presupuesto?.itemsCalculadora;

    if (!itemsCalculadora || itemsCalculadora.length === 0) {
      setModoDetectado(null);
      return;
    }

    let tieneElementosGlobales = false;
    let tieneElementosEspecificos = false;

    itemsCalculadora.forEach(item => {
      // Revisar jornales
      if (item.jornales && item.jornales.length > 0) {
        item.jornales.forEach(j => {
          const rol = (j.rol || '').toUpperCase();
          if (rol.includes('PRESUPUESTO GLOBAL') || rol.includes('PARA LA OBRA')) {
            tieneElementosGlobales = true;
          } else if (rol && !rol.includes('PRESUPUESTO GLOBAL') && !rol.includes('PARA LA OBRA')) {
            tieneElementosEspecificos = true;
          }
        });
      }

      // Revisar materiales
      if (item.materialesLista && item.materialesLista.length > 0) {
        item.materialesLista.forEach(m => {
          const nombre = (m.nombre || m.descripcion || '').toLowerCase();
          if (nombre.includes('para la') || nombre.includes('para el') ||
              nombre.includes('presupuesto global') || nombre.includes('materiales para')) {
            tieneElementosGlobales = true;
          } else if (nombre && nombre !== 'sin nombre' && !nombre.includes('presupuesto global') && !nombre.includes('para la') && !nombre.includes('para el')) {
            tieneElementosEspecificos = true;
          }
        });
      }

      // Revisar gastos generales
      if (item.gastosGenerales && item.gastosGenerales.length > 0) {
        item.gastosGenerales.forEach(g => {
          const desc = (g.descripcion || '').toLowerCase();
          if (desc.includes('para la') || desc.includes('para el') ||
              desc.includes('presupuesto global') || (desc.includes('gastos') && desc.includes('para'))) {
            tieneElementosGlobales = true;
          } else if (desc && !desc.includes('presupuesto global') && !desc.includes('para la') && !desc.includes('para el')) {
            tieneElementosEspecificos = true;
          }
        });
      }

      // Revisar otros costos
      if (item.otrosCostosLista && item.otrosCostosLista.length > 0) {
        item.otrosCostosLista.forEach(o => {
          const desc = (o.descripcion || '').toLowerCase();
          if (desc.includes('para la') || desc.includes('para el') ||
              desc.includes('presupuesto global')) {
            tieneElementosGlobales = true;
          } else if (desc && !desc.includes('presupuesto global') && !desc.includes('para la') && !desc.includes('para el')) {
            tieneElementosEspecificos = true;
          }
        });
      }
    });

    const esGlobal = tieneElementosGlobales && !tieneElementosEspecificos;

    let modo = null;
    if (esGlobal) {
      modo = 'GLOBAL';
    } else if (tieneElementosEspecificos || tieneElementosGlobales) {
      modo = 'DETALLE';
    }

    setModoDetectado(modo);
  }, [show, presupuesto]);

  return modoDetectado;
};

/**
 * Componente Badge para mostrar el modo del presupuesto
 */
export const BadgeModoPresupuesto = ({ modo }) => {
  if (!modo) return null;

  return (
    <span
      className={`badge text-white ${
        modo === 'GLOBAL' ? 'bg-secondary' :
        modo === 'MIXTO' ? 'bg-warning text-dark' :
        'bg-info'
      }`}
      style={{ fontSize: '0.7em' }}
      title={
        modo === 'GLOBAL'
          ? 'Presupuesto con importe total único - Asignación libre de montos'
          : modo === 'MIXTO'
            ? 'Presupuesto combinado - Tiene importe global + items de detalle'
            : 'Presupuesto con items individuales - Selección de lista'
      }
    >
      {modo === 'GLOBAL' && <><i className="fas fa-globe me-1"></i>Global</>}
      {modo === 'MIXTO' && <><i className="fas fa-random me-1"></i>Mixto</>}
      {modo === 'DETALLE' && <><i className="fas fa-list me-1"></i>Detallado</>}
    </span>
  );
};
