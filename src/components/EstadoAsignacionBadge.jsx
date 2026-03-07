import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

/**
 * Componente que muestra un badge con el estado de asignaciones de una obra
 * Compara los jornales del presupuesto vs los asignados y calcula impacto en tiempos
 *
 * Props:
 * - obraId: ID de la obra
 * - compact: Si es true, muestra versión compacta (solo icono + tooltip)
 */
const EstadoAsignacionBadge = ({ obraId, compact = false }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [estado, setEstado] = useState({
    cargando: true,
    tipo: 'info', // 'success', 'warning', 'danger', 'info'
    icono: '📊',
    mensaje: 'Cargando...',
    detalles: null
  });

  useEffect(() => {
    if (obraId && empresaSeleccionada) {
      cargarEstadoAsignaciones();
    }
  }, [obraId, empresaSeleccionada]);

  const cargarEstadoAsignaciones = async () => {
    try {
      // Cargar presupuesto de la obra
      let presupuestoData = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id, { obraId });

      if (!presupuestoData) {
        setEstado({
          cargando: false,
          tipo: 'secondary',
          icono: '📋',
          mensaje: 'Sin presupuesto',
          detalles: null
        });
        return;
      }

      // Si no es array, convertir a array
      if (!Array.isArray(presupuestoData)) {
        presupuestoData = [presupuestoData];
      }

      console.log(`🔍 [Badge Obra ${obraId}] Presupuestos recibidos (${presupuestoData.length}):`, presupuestoData);
      console.log(`🔍 [Badge Obra ${obraId}] Detalle:`, presupuestoData.map(p => ({
        id: p.id,
        numeroPresupuesto: p.numeroPresupuesto,
        version: p.numeroVersion || p.version,
        estado: p.estado,
        estadoRaw: JSON.stringify(p.estado),
        tiempoEstimado: p.tiempoEstimadoTerminacion,
        esAprobado: p.estado === 'APROBADO'
      })));

      // 🎯 LÓGICA DEFINITIVA: Seleccionar SOLO la última versión en estados válidos
      // Estados válidos: APROBADO, EN_EJECUCION, SUSPENDIDO, CANCELADO, TERMINADO, FINALIZADO
      const ESTADOS_VALIDOS = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDO', 'CANCELADO', 'TERMINADO', 'FINALIZADO'];

      let presupuesto = null;
      if (Array.isArray(presupuestoData) && presupuestoData.length > 0) {
        // Agrupar por numeroPresupuesto
        const porNumero = {};
        presupuestoData.forEach(p => {
          const num = p.numeroPresupuesto;
          if (!porNumero[num]) porNumero[num] = [];
          porNumero[num].push(p);
        });

        console.log(`📊 [Badge Obra ${obraId}] Agrupados:`, Object.keys(porNumero).map(num => ({
          numero: num,
          versiones: porNumero[num].map(p => ({ version: p.numeroVersion || p.version, estado: p.estado }))
        })));

        // Para cada grupo, seleccionar solo la versión con estado válido más reciente
        const presupuestosValidos = [];
        Object.values(porNumero).forEach(versiones => {
          const validos = versiones.filter(p => ESTADOS_VALIDOS.includes(p.estado));

          if (validos.length > 0) {
            // Ordenar por versión descendente y tomar el primero
            validos.sort((a, b) => {
              const vA = a.numeroVersion || a.version || 0;
              const vB = b.numeroVersion || b.version || 0;
              return vB - vA;
            });
            presupuestosValidos.push(validos[0]);
          }
        });

        // Tomar el primer presupuesto válido encontrado
        presupuesto = presupuestosValidos.length > 0 ? presupuestosValidos[0] : null;

        console.log(`✅ [Badge Obra ${obraId}] Presupuesto seleccionado:`, presupuesto ? {
          id: presupuesto.id,
          version: presupuesto.numeroVersion || presupuesto.version,
          estado: presupuesto.estado,
          tiempoEstimado: presupuesto.tiempoEstimadoTerminacion
        } : 'NINGUNO');
      }

      if (!presupuesto) {
        setEstado({
          cargando: false,
          tipo: 'warning',
          icono: '⚠️',
          mensaje: 'Presupuesto Abreviado',
          detalles: null
        });
        return;
      }

      if (!presupuesto.tiempoEstimadoTerminacion) {
        setEstado({
          cargando: false,
          tipo: 'secondary',
          icono: '📋',
          mensaje: 'Sin tiempo estimado',
          detalles: null
        });
        return;
      }

      // 2. Cargar asignaciones de la obra
      const asignaciones = await api.get(`/api/obras/${obraId}/asignaciones-profesionales`, { empresaId: empresaSeleccionada.id }) || [];

      // 3. Calcular estado
      calcularEstado(presupuesto, asignaciones);
    } catch (err) {
      console.error('Error cargando estado de asignaciones:', err);
      setEstado({
        cargando: false,
        tipo: 'secondary',
        icono: '❌',
        mensaje: 'Error',
        detalles: null
      });
    }
  };

  const calcularEstado = (presupuesto, asignaciones) => {
    // 🏗️ PARA EL CÁLCULO DE DÍAS: Solo rubros marcados con incluirEnCalculoDias = true
    const jornalesPlanificados = presupuesto.itemsCalculadora?.reduce((total, rubro) => {
      // ✅ FILTRAR rubros duplicados/legacy
      const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');

      if (esLegacyDuplicado) return total;

      // Por defecto incluir si no está definido (retrocompatibilidad)
      const incluir = rubro.incluirEnCalculoDias !== false;
      if (!incluir) return total;

      const jornalesRubro = rubro.jornales?.reduce((sum, j) => sum + (j.cantidad || 0), 0) || 0;
      const profesionalesRubro = rubro.profesionales?.reduce((sum, p) => sum + (p.cantidadJornales || 0), 0) || 0;
      return total + jornalesRubro + profesionalesRubro;
    }, 0) || 0;

    // Jornales asignados de los rubros incluidos en cálculo
    // Obtener lista de rubros que están marcados para incluir
    const rubrosIncluidos = presupuesto.itemsCalculadora?.filter(rubro => {
      const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
      if (esLegacyDuplicado) return false;
      return rubro.incluirEnCalculoDias !== false;
    }).map(r => r.tipoProfesional?.trim().toLowerCase()) || [];

    const jornalesAsignados = asignaciones.reduce((sum, a) => {
      const rubroNombre = a.rubroNombre?.trim().toLowerCase();
      const estaIncluido = rubrosIncluidos.some(r => rubroNombre?.includes(r?.split(' ')[0])); // Comparar palabra clave
      if (!estaIncluido) return sum;
      return sum + (a.cantidadJornales || 0);
    }, 0);

    // 👥 PARA EL BADGE: Contar TODOS los profesionales asignados (cualquier rubro)
    const totalProfesionalesAsignados = asignaciones.length;

    const diasEstimadosOriginal = Number(presupuesto.tiempoEstimadoTerminacion) || 0;

    // Sin asignaciones de ningún tipo
    if (totalProfesionalesAsignados === 0) {
      setEstado({
        cargando: false,
        tipo: 'warning',
        icono: '⚠️',
        mensaje: 'Sin profesionales asignados',
        detalles: {
          jornalesPlanificados: jornalesPlanificados,
          jornalesAsignados: 0,
          diasEstimados: diasEstimadosOriginal,
          porcentaje: 0
        }
      });
      return;
    }

    // Si NO hay jornales planificados (ningún rubro incluido), no podemos calcular días
    if (jornalesPlanificados === 0) {
      setEstado({
        cargando: false,
        tipo: 'info',
        icono: '👥',
        mensaje: `${totalProfesionalesAsignados} profesional${totalProfesionalesAsignados !== 1 ? 'es' : ''} asignado${totalProfesionalesAsignados !== 1 ? 's' : ''}`,
        detalles: {
          profesionalesAsignados: totalProfesionalesAsignados,
          sinCalculoDias: true
        }
      });
      return;
    }

    // Si NO hay jornales asignados de rubros incluidos
    if (jornalesAsignados === 0) {
      setEstado({
        cargando: false,
        tipo: 'warning',
        icono: '⚠️',
        mensaje: `${totalProfesionalesAsignados} asignado${totalProfesionalesAsignados !== 1 ? 's' : ''}, sin rubros clave`,
        detalles: {
          jornalesPlanificados: jornalesPlanificados,
          jornalesAsignados: 0,
          diasEstimados: diasEstimadosOriginal,
          porcentaje: 0,
          profesionalesAsignados: totalProfesionalesAsignados
        }
      });
      return;
    }

    // 🧮 CÁLCULO DE DÍAS REALES SEGÚN CAPACIDAD DIARIA
    // jornalesAsignados = capacidad diaria (suma de profesionales asignados)
    // Cada profesional aporta 1 jornal/día
    // Días reales = Jornales totales / Capacidad diaria

    const capacidadDiaria = jornalesAsignados;
    const diasRealesEstimados = Math.ceil(jornalesPlanificados / capacidadDiaria);
    const diferenciaDias = diasRealesEstimados - diasEstimadosOriginal;
    const capacidadNecesaria = Math.ceil(jornalesPlanificados / diasEstimadosOriginal);
    const porcentajeCapacidad = (capacidadDiaria / capacidadNecesaria * 100);

    // Determinar estado
    let tipo, icono, mensaje;

    if (diasRealesEstimados > diasEstimadosOriginal) {
      tipo = 'danger';
      icono = '🚨';
      mensaje = `+${Math.abs(diferenciaDias)} día${Math.abs(diferenciaDias) !== 1 ? 's' : ''} más`;
    } else if (Math.abs(diferenciaDias) <= 5) {
      tipo = 'success';
      icono = '✅';
      mensaje = 'A tiempo';
    } else {
      tipo = 'info';
      icono = '🚀';
      mensaje = `${Math.abs(diferenciaDias)} día${Math.abs(diferenciaDias) !== 1 ? 's' : ''} antes`;
    }

    setEstado({
      cargando: false,
      tipo,
      icono,
      mensaje,
      detalles: {
        jornalesPlanificados: jornalesPlanificados,
        capacidadDiaria: capacidadDiaria,
        diasEstimados: diasEstimadosOriginal,
        diasReales: diasRealesEstimados,
        diferenciaDias,
        porcentaje: porcentajeCapacidad.toFixed(1),
        profesionalesAsignados: totalProfesionalesAsignados
      }
    });
  };

  if (estado.cargando) {
    return (
      <div className="spinner-border spinner-border-sm text-secondary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>
    );
  }

  if (compact) {
    // Versión compacta con tooltip
    return (
      <span
        className={`badge bg-${estado.tipo}`}
        data-bs-toggle="tooltip"
        data-bs-placement="top"
        title={estado.detalles ?
          `${estado.mensaje} | ${estado.detalles.capacidadDiaria} jornales/día | ${estado.detalles.diasReales} días estimados`
          : estado.mensaje}
        style={{ cursor: 'help' }}
      >
        {estado.icono}
      </span>
    );
  }

  // Versión expandida
  return (
    <div className={`badge bg-${estado.tipo} ${estado.tipo === 'warning' ? 'text-dark' : 'text-white'} d-inline-flex align-items-center gap-1`}>
      <span>{estado.icono}</span>
      <span className="small">{estado.mensaje}</span>
      {estado.detalles && (
        <small className="ms-1 opacity-75">
          ({estado.detalles.porcentaje}%)
        </small>
      )}
    </div>
  );
};

export default EstadoAsignacionBadge;
