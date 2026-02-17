import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { listarPagosConsolidadosPorPresupuesto } from '../services/pagosConsolidadosService';
import { obtenerSaldoDisponible } from '../services/retirosPersonalesService';
import { obtenerResumenCobrosEmpresa } from '../services/cobrosEmpresaService';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import {
  cargarEstadisticasParaEntidades,
  inferirTipoEntidad
} from '../services/entidadesFinancierasService';

// Funcin helper para calcular total del presupuesto (mismo orden de prioridad que consolidadas)
const calcularTotalPresupuestoObra = (presupuesto) => {
  // Prioridad 1: totalFinal
  if (presupuesto.totalFinal && presupuesto.totalFinal > 0) {
    return parseFloat(presupuesto.totalFinal);
  }

  // Prioridad 2: valorTotalIva
  if (presupuesto.valorTotalIva && presupuesto.valorTotalIva > 0) {
    return parseFloat(presupuesto.valorTotalIva);
  }

  // Prioridad 3: Calcular desde itemsCalculadora
  const itemsCalculadora = presupuesto.itemsCalculadora || [];
  if (itemsCalculadora.length > 0) {
    let totalBase = 0;

    itemsCalculadora.forEach((item) => {
      // Jornales del item
      const cantidadJornales = parseFloat(item.cantidadJornales || 0);
      const importeJornal = parseFloat(item.importeJornal || 0);
      totalBase += cantidadJornales * importeJornal;

      // Profesionales
      if (item.profesionales && Array.isArray(item.profesionales)) {
        item.profesionales.forEach((prof) => {
          totalBase += parseFloat(prof.subtotal || 0);
        });
      }
      // Materiales
      if (item.materialesLista && Array.isArray(item.materialesLista)) {
        item.materialesLista.forEach((mat) => {
          totalBase += parseFloat(mat.subtotal || 0);
        });
      }
      // Otros costos
      if (item.otrosCostos && Array.isArray(item.otrosCostos)) {
        item.otrosCostos.forEach((costo) => {
          totalBase += parseFloat(costo.subtotal || costo.importe || 0);
        });
      }
    });

    if (totalBase > 0) {
      // 1. Aplicar honorarios
      const porcentajeHonorarios = parseFloat(presupuesto.porcentajeHonorarios || presupuesto.porcentajeHonorariosEsperado || 0);
      const totalHonorarios = totalBase * (porcentajeHonorarios / 100);
      const subtotalConHonorarios = totalBase + totalHonorarios;

      // 2. Aplicar mayores costos sobre (base + honorarios)
      const porcentajeMayoresCostos = parseFloat(presupuesto.porcentajeMayoresCostos || 0);
      const totalMayoresCostos = subtotalConHonorarios * (porcentajeMayoresCostos / 100);

      // Total SIN IVA
      return subtotalConHonorarios + totalMayoresCostos;
    }
  }

  // Prioridad 3: totalPresupuestoConHonorarios
  if (presupuesto.totalPresupuestoConHonorarios && presupuesto.totalPresupuestoConHonorarios > 0) {
    return parseFloat(presupuesto.totalPresupuestoConHonorarios);
  }

  // Prioridad 4: valorTotal
  if (presupuesto.valorTotal && presupuesto.valorTotal > 0) {
    return parseFloat(presupuesto.valorTotal);
  }

  // Prioridad 5: totalPresupuesto + honorarios
  if (presupuesto.totalPresupuesto && presupuesto.totalPresupuesto > 0) {
    return parseFloat(presupuesto.totalPresupuesto) + parseFloat(presupuesto.totalHonorariosCalculado || 0);
  }

  return 0;
};

/**
 * Hook para cargar y calcular estadsticas de obras especficamente seleccionadas
 * Similar a useEstadisticasConsolidadas pero solo para obras con checkbox activo
 */
export const useEstadisticasObrasSeleccionadas = (presupuestosSeleccionados, empresaId, refreshTrigger) => {
  const [profesionales, setProfesionales] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [otrosCostos, setOtrosCostos] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    totalPresupuesto: 0,
    totalCobrado: 0,
    totalCobradoEmpresa: 0, //  Total cobrado a nivel empresa
    totalAsignado: 0,
    saldoCobradoSinAsignar: 0,
    totalPagado: 0,
    totalRetirado: 0,
    saldoDisponible: 0,
    porcentajeCobrado: 0,
    porcentajePagado: 0,
    porcentajeDisponible: 0,
    cantidadObras: 0,
    alertas: [],
    desglosePorObra: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargarDatosSeleccionados = useCallback(async () => {
    if (!presupuestosSeleccionados || presupuestosSeleccionados.length === 0 || !empresaId) {
      setProfesionales([]);
      setMateriales([]);
      setOtrosCostos([]);
      setEstadisticas({
        totalPresupuesto: 0,
        totalCobrado: 0,
        totalCobradoEmpresa: 0,
        totalAsignado: 0,
        saldoCobradoSinAsignar: 0,
        totalPagado: 0,
        totalRetirado: 0,
        saldoDisponible: 0,
        porcentajeCobrado: 0,
        porcentajePagado: 0,
        porcentajeDisponible: 0,
        cantidadObras: 0,
        alertas: [],
        desglosePorObra: []
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(' [ObrasSeleccionadas] Cargando datos de', presupuestosSeleccionados.length, 'obras seleccionadas');

      // Separar obras que tienen presupuesto de las que no (obras independientes y trabajos adicionales)
      const obrasConPresupuesto = presupuestosSeleccionados.filter(p =>
        !p.esObraIndependiente && !p._esTrabajoAdicional && p.id
      );
      const obrasSinPresupuesto = presupuestosSeleccionados.filter(p =>
        p.esObraIndependiente || p._esTrabajoAdicional
      );

      console.log(' [ObrasSeleccionadas] Desglose:', {
        total: presupuestosSeleccionados.length,
        conPresupuesto: obrasConPresupuesto.length,
        sinPresupuesto: obrasSinPresupuesto.length,
        obrasSinPresupuesto: obrasSinPresupuesto.map(o => ({
          id: o.id,
          nombre: o.nombreObra,
          esIndependiente: o.esObraIndependiente,
          esTrabajoAdicional: o._esTrabajoAdicional
        }))
      });

      // Cargar datos completos solo de las obras que tienen presupuesto
      const presupuestosCompletos = obrasConPresupuesto.length > 0
        ? await Promise.all(
            obrasConPresupuesto.map(p => api.presupuestosNoCliente.getById(p.id, empresaId))
          )
        : [];

      // Para obras sin presupuesto, usar sus datos directamente
      const todasLasObras = [
        ...presupuestosCompletos,
        ...obrasSinPresupuesto.map(obra => ({
          ...obra,
          itemsCalculadora: obra.itemsCalculadora || [],
          profesionalesObra: obra.profesionalesObra || [],
          materialesAsignados: obra.materialesAsignados || [],
          gastosGeneralesAsignados: obra.gastosGeneralesAsignados || []
        }))
      ];

      // -----------------------------------------------------------------------
      // SISTEMA UNIFICADO: Cargar estadisticas para TODAS las entidades
      // Incluye OBRA_PRINCIPAL, OBRA_INDEPENDIENTE, TRABAJO_EXTRA, TRABAJO_ADICIONAL
      // -----------------------------------------------------------------------
      let estadisticasUnificadas = [];
      try {
        estadisticasUnificadas = await cargarEstadisticasParaEntidades(empresaId, presupuestosSeleccionados);
        console.log('[ObrasSeleccionadas] Estadisticas unificadas cargadas:', estadisticasUnificadas.length, 'entidades');
      } catch (estadError) {
        console.warn('[ObrasSeleccionadas] Sistema unificado no disponible (backend pendiente de deploy):', estadError?.message);
      }

      // Cargar cobros de cada obra
      const cobrosPromises = presupuestosSeleccionados.map(async (presupuesto) => {
        try {
          const response = await api.get('/api/v1/cobros-obra', {
            params: { empresaId }
          });
          const todosCobros = Array.isArray(response.data) ? response.data :
                             Array.isArray(response) ? response : [];
          return todosCobros.filter(c => c.presupuestoNoClienteId === presupuesto.id);
        } catch (error) {
          console.error(`Error al cargar cobros para presupuesto ${presupuesto.id}:`, error);
          return [];
        }
      });

      const cobrosPorPresupuesto = await Promise.all(cobrosPromises);

      // Cargar pagos consolidados (solo para obras con presupuesto)
      const todosPagosConsolidados = await Promise.all(
        todasLasObras.map(p => {
          // Solo cargar pagos si la obra tiene presupuesto
          if (p.esObraIndependiente || p._esTrabajoAdicional) {
            return Promise.resolve([]);
          }
          return listarPagosConsolidadosPorPresupuesto(p.id, empresaId)
            .catch(err => {
              console.warn(` Error cargando pagos para presupuesto ${p.id}:`, err);
              return [];
            });
        })
      );

      // Crear mapa de pagos por presupuesto
      const pagosMap = {};
      todasLasObras.forEach((presupuesto, idx) => {
        pagosMap[presupuesto.id] = todosPagosConsolidados[idx] || [];
      });

      // Extraer profesionales, materiales y otros costos
      const todosProfesionales = [];
      const todosMateriales = [];
      const todosOtrosCostos = [];
      let contadorProfesionales = 0;

      let totalPresupuesto = 0;
      let totalPagado = 0;

      // -----------------------------------------------------------------------
      // TOTAL COBRADO: Usar sistema unificado si esta disponible; si no, fallback al sistema legacy
      // El sistema unificado cubre los 4 tipos de entidad
      // El sistema legacy solo cubre OBRA_PRINCIPAL (filtrado por presupuestoNoClienteId)
      // -----------------------------------------------------------------------
      let totalCobrado = 0;

      if (estadisticasUnificadas.length > 0) {
        // FUENTE PRIMARIA: sistema unificado de entidades financieras
        totalCobrado = estadisticasUnificadas.reduce(
          (sum, ef) => sum + (parseFloat(ef.totalCobrado) || 0),
          0
        );
        console.log(`[ObrasSeleccionadas] Total cobrado (sistema unificado, ${estadisticasUnificadas.length} entidades): $${totalCobrado.toLocaleString()}`);
      } else {
        // FALLBACK: cobros del sistema legacy, solo obras principales
        try {
          const response = await api.get('/api/v1/cobros-obra', { params: { empresaId } });
          const todosLosCobros = Array.isArray(response) ? response :
            response?.data ? response.data :
            response?.cobros ? response.cobros : [];

          const presupuestosIds = presupuestosSeleccionados.map(p => p.id);
          const cobrosObrasSeleccionadas = todosLosCobros.filter(c =>
            presupuestosIds.includes(c.presupuestoNoClienteId)
          );
          const cobrosCobrados = cobrosObrasSeleccionadas.filter(c => c.estado === 'COBRADO' || c.estado === 'cobrado');
          totalCobrado = cobrosCobrados.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
          console.log(`[ObrasSeleccionadas] Total cobrado (legacy, solo obras principales): $${totalCobrado.toLocaleString()}`);
        } catch (error) {
          console.warn('[ObrasSeleccionadas] Error cargando cobros (sistema legacy):', error);
        }
      }

      //  Obtener TODAS las asignaciones de la empresa una sola vez
      let todasLasAsignaciones = [];
      try {
        const { obtenerTodasAsignaciones } = await import('../services/asignacionesCobroObraService');
        todasLasAsignaciones = await obtenerTodasAsignaciones(empresaId);
        console.log(` [ObrasSeleccionadas] Total de asignaciones: ${todasLasAsignaciones.length}`);
      } catch (error) {
        console.warn(` Error cargando asignaciones:`, error);
      }

      for (let idx = 0; idx < todasLasObras.length; idx++) {
        const presupuesto = todasLasObras[idx];
        const itemsCalculadora = presupuesto.itemsCalculadora || [];
        const nombreObra = presupuesto.nombreObra || presupuesto.direccionObra?.direccion || `Presupuesto #${presupuesto.numeroPresupuesto}`;

        // Sumar al presupuesto total usando la misma lgica que consolidadas
        const presupuestoObra = calcularTotalPresupuestoObra(presupuesto);
        totalPresupuesto += presupuestoObra;

        //  USAR ENDPOINT DE RESUMEN FINANCIERO (igual que consolidadas)
        // Este endpoint incluye TODOS los tipos de pagos: profesionales, materiales, gastos generales
        let pagadoObra = 0;
        try {
          const obraId = presupuesto.obraId || presupuesto.direccionObraId;
          if (obraId) {
            const resumen = await api.get(`/api/v1/obras-financiero/${obraId}/resumen`, { params: { empresaId } });
            pagadoObra = resumen.totalPagadoGeneral || 0;
            console.log(`   [ObrasSeleccionadas] "${nombreObra}" (obraId=${obraId}): Total pagado=$${pagadoObra.toLocaleString()}`);
          } else {
            console.warn(`   [ObrasSeleccionadas] "${nombreObra}": No tiene obraId, usando pagos consolidados (pueden no incluir pagos individuales)`);
            const pagosObra = pagosMap[presupuesto.id] || [];
            pagadoObra = pagosObra
              .filter(p => p.estado === 'PAGADO')
              .reduce((sum, p) => sum + (parseFloat(p.montoNeto || p.montoBruto) || 0), 0);
          }
        } catch (error) {
          console.warn(`   Error obteniendo resumen financiero de obra ${presupuesto.obraId}:`, error);
          // Fallback a pagos consolidados
          const pagosObra = pagosMap[presupuesto.id] || [];
          pagadoObra = pagosObra
            .filter(p => p.estado === 'PAGADO')
            .reduce((sum, p) => sum + (parseFloat(p.montoNeto || p.montoBruto) || 0), 0);
        }
        totalPagado += pagadoObra;

        // Extraer profesionales
        itemsCalculadora.forEach((item) => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach((prof, profIdx) => {
              contadorProfesionales++;
              const idUnico = `${presupuesto.id}-${prof.id}-${contadorProfesionales}`;
              const precioTotal = (prof.cantidadJornales || 0) * (prof.importeJornal || 0);

              // Buscar pagos existentes para este profesional
              const pagosPresupuesto = pagosMap[presupuesto.id] || [];
              const pagosProfesional = pagosPresupuesto.filter(pago =>
                pago.tipoPago === 'PROFESIONALES' &&
                pago.profesionalObraId === prof.profesionalObraId
              );

              const totalPagadoProfesional = pagosProfesional
                .filter(p => p.estado === 'PAGADO')
                .reduce((sum, p) => sum + parseFloat(p.montoNeto || p.montoBruto || 0), 0);

              const saldoPendiente = precioTotal - totalPagadoProfesional;
              const porcentajePagado = precioTotal > 0 ? (totalPagadoProfesional / precioTotal) * 100 : 0;

              todosProfesionales.push({
                id: idUnico,
                profesionalId: prof.id,
                profesionalObraId: prof.profesionalObraId || prof.id,
                indiceEnLista: contadorProfesionales,
                presupuestoId: presupuesto.id,
                nombreObra: nombreObra,
                tipoProfesional: prof.tipo || item.tipoProfesional || 'Sin tipo',
                nombre: prof.nombre || `${prof.tipo || item.tipoProfesional} #${profIdx + 1}`,
                cantidadJornales: prof.cantidadJornales || 0,
                precioJornal: prof.importeJornal || 0,
                precioTotal: precioTotal,
                nombreCompleto: prof.nombre || `${prof.tipo || item.tipoProfesional} #${profIdx + 1}`,
                totalPagado: totalPagadoProfesional,
                saldoPendiente: saldoPendiente,
                porcentajePagado: porcentajePagado,
                pagos: pagosProfesional
              });
            });
          }
        });

        // Extraer materiales
        itemsCalculadora.forEach((item, itemIdx) => {
          if (item.materialesLista && Array.isArray(item.materialesLista)) {
            item.materialesLista.forEach((mat, matIdx) => {
              const pagosPresupuesto = pagosMap[presupuesto.id] || [];
              const pagoExistente = pagosPresupuesto.find(pago =>
                pago.tipoPago === 'MATERIALES' &&
                pago.itemCalculadoraId === item.id &&
                pago.materialCalculadoraId === mat.id
              );

              const totalPagadoMaterial = pagoExistente && pagoExistente.estado === 'PAGADO'
                ? parseFloat(pagoExistente.montoNeto || pagoExistente.montoBruto || 0)
                : 0;

              const saldoPendiente = (mat.subtotal || 0) - totalPagadoMaterial;
              const porcentajePagado = mat.subtotal > 0 ? (totalPagadoMaterial / mat.subtotal) * 100 : 0;

              todosMateriales.push({
                id: `${presupuesto.id}-mat-${itemIdx}-${matIdx}`,
                presupuestoId: presupuesto.id,
                itemCalculadoraId: item.id,
                materialCalculadoraId: mat.id,
                nombreObra: nombreObra,
                nombre: mat.nombre || 'Sin nombre',
                cantidadUnidades: mat.cantidad || 0,
                precioUnidad: mat.precioUnitario || 0,
                precioTotal: mat.subtotal || 0,
                totalPagado: totalPagadoMaterial,
                saldoPendiente: saldoPendiente,
                porcentajePagado: porcentajePagado,
                pagado: !!pagoExistente && pagoExistente.estado === 'PAGADO'
              });
            });
          }
        });

        // Extraer otros costos
        itemsCalculadora.forEach((item, itemIdx) => {
          if (item.otrosCostos && Array.isArray(item.otrosCostos)) {
            item.otrosCostos.forEach((costo, costoIdx) => {
              const pagosPresupuesto = pagosMap[presupuesto.id] || [];
              const pagoExistente = pagosPresupuesto.find(pago =>
                pago.tipoPago === 'OTROS_COSTOS' &&
                pago.itemCalculadoraId === item.id &&
                pago.otroCostoCalculadoraId === costo.id
              );

              const totalPagadoCosto = pagoExistente && pagoExistente.estado === 'PAGADO'
                ? parseFloat(pagoExistente.montoNeto || pagoExistente.montoBruto || 0)
                : 0;

              const saldoPendiente = (costo.subtotal || 0) - totalPagadoCosto;
              const porcentajePagado = costo.subtotal > 0 ? (totalPagadoCosto / costo.subtotal) * 100 : 0;

              todosOtrosCostos.push({
                id: `${presupuesto.id}-costo-${itemIdx}-${costoIdx}`,
                presupuestoId: presupuesto.id,
                itemCalculadoraId: item.id,
                otroCostoCalculadoraId: costo.id,
                nombreObra: nombreObra,
                descripcion: costo.descripcion || 'Sin descripcin',
                precioTotal: costo.subtotal || 0,
                totalPagado: totalPagadoCosto,
                saldoPendiente: saldoPendiente,
                porcentajePagado: porcentajePagado,
                pagado: !!pagoExistente && pagoExistente.estado === 'PAGADO'
              });
            });
          }
        });
      }

      //  AGREGAR PAGOS DE TRABAJOS EXTRA (solo de las obras seleccionadas)
      let totalPagadoTrabajosExtra = 0;
      let pagosTrabajosExtraPorObra = {}; //  Mapa para agrupar por obraId

      try {
        const pagosTrabajosExtra = await api.pagosTrabajoExtra.getByEmpresa(empresaId);

        // Filtrar solo los pagos de las obras seleccionadas
        const presupuestosIds = presupuestosSeleccionados.map(p => p.id);
        const pagosFiltrados = pagosTrabajosExtra.filter(p =>
          presupuestosIds.includes(p.presupuestoNoClienteId)
        );

        //  Agrupar trabajos extra por obraId
        pagosFiltrados.filter(p => p.estado === 'PAGADO').forEach(pago => {
          const obraId = pago.obraId;
          if (!pagosTrabajosExtraPorObra[obraId]) {
            pagosTrabajosExtraPorObra[obraId] = 0;
          }
          const monto = parseFloat(pago.montoFinal || pago.monto || 0);
          pagosTrabajosExtraPorObra[obraId] += monto;
        });

        totalPagadoTrabajosExtra = Object.values(pagosTrabajosExtraPorObra).reduce((sum, val) => sum + val, 0);

        // Sumar trabajos extra al total general
        totalPagado += totalPagadoTrabajosExtra;
      } catch (error) {
        console.warn(' No se pudieron cargar pagos de trabajos extra:', error);
      }

      // Calcular estadsticas

      //  Obtener total retirado y desglose por obra
      let totalRetirado = 0;
      let retirosPorObra = {}; // { obraId: monto }
      let retirosGenerales = 0;

      try {
        const { listarRetiros } = await import('../services/retirosPersonalesService');
        const todosLosRetiros = await listarRetiros(empresaId);

        // Calcular total retirado
        totalRetirado = todosLosRetiros
          .filter(r => r.estado !== 'ANULADO')
          .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);

        // Separar retiros por obra y retiros generales
        todosLosRetiros
          .filter(r => r.estado !== 'ANULADO')
          .forEach(retiro => {
            const monto = parseFloat(retiro.monto) || 0;

            // Si tiene obra especfica (obraId existe y no es null)
            if (retiro.obraId) {
              const obraId = retiro.obraId;
              if (!retirosPorObra[obraId]) {
                retirosPorObra[obraId] = 0;
              }
              retirosPorObra[obraId] += monto;
            } else {
              // Retiro general (obra_id es NULL en BD)
              retirosGenerales += monto;
            }
          });
      } catch (error) {
        console.error(' Error obteniendo retiros:', error);
        totalRetirado = 0;
      }

      //  Obtener totales de cobros a nivel empresa
      let totalCobradoEmpresa = 0;
      let saldoDisponibleEmpresa = 0;
      try {
        const resumenEmpresa = await obtenerResumenCobrosEmpresa(empresaId);
        totalCobradoEmpresa = parseFloat(resumenEmpresa?.totalCobrado || 0);
        saldoDisponibleEmpresa = parseFloat(resumenEmpresa?.totalDisponible || 0);
        console.log(' [ObrasSeleccionadas] Cobros empresa:', {
          totalCobrado: totalCobradoEmpresa,
          totalAsignado: resumenEmpresa?.totalAsignado,
          totalDisponible: saldoDisponibleEmpresa
        });
      } catch (error) {
        console.error(' Error obteniendo cobros empresa (backend no implementado):', error.message);
        console.warn(' Usando totalCobrado de obras como fallback temporal');
        totalCobradoEmpresa = 0;
        saldoDisponibleEmpresa = 0;
      }

      //  Calcular total asignado de cobros a rubros (solo de obras seleccionadas)
      let totalAsignado = 0;
      try {
        totalAsignado = todasLasAsignaciones
          .filter(a => {
            const esObraSeleccionada = presupuestosSeleccionados.some(p =>
              p.id === a.presupuestoNoClienteId || p.obraId === a.obraId
            );
            return esObraSeleccionada && (a.estado === 'ACTIVA' || a.estado === 'activa');
          })
          .reduce((sum, a) => sum + (parseFloat(a.montoAsignado) || 0), 0);
        console.log(' [ObrasSeleccionadas] Total asignado a rubros:', totalAsignado);
      } catch (error) {
        console.error(' Error calculando total asignado:', error);
        totalAsignado = 0;
      }

      console.log(' [ObrasSeleccionadas] Total Presupuesto BASE (sin trabajos extra):', totalPresupuesto.toLocaleString());

      //  Obtener IDs de presupuestos que YA son trabajos extra para evitar duplicados
      const idsPresupuestosTrabajosExtra = todasLasObras
        .filter(p => p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V' || p.es_presupuesto_trabajo_extra === true)
        .map(p => p.id);

      console.log(' [ObrasSeleccionadas] Presupuestos que YA son trabajos extra:', {
        cantidad: idsPresupuestosTrabajosExtra.length,
        ids: idsPresupuestosTrabajosExtra,
        presupuestos: todasLasObras
          .filter(p => p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V' || p.es_presupuesto_trabajo_extra === true)
          .map(p => ({ id: p.id, nombre: p.nombreObra, total: calcularTotalPresupuestoObra(p) }))
      });

      //  Sumar trabajos extra al presupuesto total (solo los que NO estn en presupuestos_no_cliente)
      let totalTrabajosExtra = 0;
      const obraIds = todasLasObras.map(p => p.obraId || p.direccionObraId).filter(Boolean);

      if (obraIds.length > 0) {
        try {
          const trabajosExtraPromises = obraIds.map(async (obraId) => {
            try {
              const response = await api.trabajosExtra.getAll(empresaId, { obraId });
              const trabajos = Array.isArray(response) ? response : response?.data || [];

              const trabajosConTotal = await Promise.all(trabajos.map(async (trabajo) => {
                try {
                  const fullResponse = await api.trabajosExtra.getById(trabajo.id, empresaId);
                  const fullTrabajo = fullResponse.data || fullResponse;

                  //  EVITAR DUPLICADOS: Si el trabajo extra tiene presupuestoNoClienteId y ya fue contado, marcarlo
                  if (fullTrabajo.presupuestoNoClienteId && idsPresupuestosTrabajosExtra.includes(fullTrabajo.presupuestoNoClienteId)) {
                    console.log(`   [ObrasSeleccionadas] Trabajo extra "${fullTrabajo.nombre}" (ID: ${fullTrabajo.id}) YA fue contado como presupuesto ${fullTrabajo.presupuestoNoClienteId}, omitiendo`);
                    return null; // Marcarlo para filtrarlo
                  }

                  return fullTrabajo;
                } catch (err) {
                  return trabajo;
                }
              }));

              const totalObra = trabajosConTotal.filter(t => t !== null).reduce((sum, t) => {
                const parseMontoLocal = (val) => {
                  if (typeof val === 'number') return val;
                  if (!val) return 0;
                  let str = String(val).trim().replace(/[^0-9.,-]/g, '');
                  if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
                  return parseFloat(str) || 0;
                };

                if (t.itemsCalculadora && Array.isArray(t.itemsCalculadora) && t.itemsCalculadora.length > 0) {
                  let subtotalJornales = 0, subtotalMateriales = 0, subtotalOtros = 0;
                  t.itemsCalculadora.forEach((item) => {
                    let jorItem = parseMontoLocal(item.subtotalManoObra) || 0;
                    if (jorItem === 0 && item.jornales && Array.isArray(item.jornales)) {
                      jorItem = item.jornales.reduce((s, j) => s + (parseMontoLocal(j.subtotal) || parseMontoLocal(j.importe) || 0), 0);
                    }
                    subtotalJornales += jorItem;
                    subtotalMateriales += parseMontoLocal(item.subtotalMateriales) || 0;
                    subtotalOtros += parseMontoLocal(item.subtotalGastosGenerales) || 0;
                  });

                  const subtotalBase = subtotalJornales + subtotalMateriales + subtotalOtros;
                  let totalHonorarios = 0;
                  if (t.honorarios && typeof t.honorarios === 'object') {
                    const conf = t.honorarios;
                    if (conf.jornalesActivo && conf.jornalesValor) totalHonorarios += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                    if (conf.materialesActivo && conf.materialesValor) totalHonorarios += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                    if (conf.otrosCostosActivo && conf.otrosCostosValor) totalHonorarios += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                  }

                  let totalMC = 0;
                  if (t.mayoresCostos && typeof t.mayoresCostos === 'object') {
                    const conf = t.mayoresCostos;
                    if (conf.jornalesActivo && conf.jornalesValor) totalMC += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                    if (conf.materialesActivo && conf.materialesValor) totalMC += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                    if (conf.otrosCostosActivo && conf.otrosCostosValor) totalMC += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                    if (conf.honorariosActivo && conf.honorariosValor && totalHonorarios > 0) totalMC += totalHonorarios * (parseFloat(conf.honorariosValor) / 100);
                  }

                  return sum + subtotalBase + totalHonorarios + totalMC;
                }

                const total = parseFloat(t.totalFinal) || parseFloat(t.montoTotal) || parseFloat(t.totalCalculado) || 0;
                return sum + total;
              }, 0);

              return totalObra;
            } catch (error) {
              console.warn(` Error cargando trabajos extra de obra ${obraId}:`, error);
              return 0;
            }
          });

          const totalesPorObra = await Promise.all(trabajosExtraPromises);
          totalTrabajosExtra = totalesPorObra.reduce((sum, total) => sum + total, 0);

          console.log(' [ObrasSeleccionadas] Total trabajos extra:', totalTrabajosExtra.toLocaleString());
          totalPresupuesto += totalTrabajosExtra;
          console.log(' [ObrasSeleccionadas] Total Presupuesto FINAL (base + trabajos extra):', totalPresupuesto.toLocaleString());
        } catch (error) {
          console.warn(' Error cargando trabajos extra:', error);
        }
      }

      const saldoDisponible = totalCobradoEmpresa - totalPagado - totalRetirado;
      const saldoCobradoSinAsignar = saldoDisponibleEmpresa; // Usar el valor del endpoint
      const porcentajeCobrado = totalPresupuesto > 0 ? (totalCobradoEmpresa / totalPresupuesto) * 100 : 0;
      const porcentajePagado = totalPresupuesto > 0 ? (totalPagado / totalPresupuesto) * 100 : 0;
      const porcentajeDisponible = totalPresupuesto > 0 ? (saldoDisponible / totalPresupuesto) * 100 : 0;

      console.log(` [ObrasSeleccionadas] Mtricas finales:`, {
        totalCobradoEmpresa,
        totalAsignado,
        saldoCobradoSinAsignar,
        totalPagado,
        totalRetirado,
        saldoDisponible
      });

      //  Generar desglose por obra para el modal
      const desglosePorObra = [];

      //  Obtener resumen financiero de cada obra para tener los pagos reales
      for (const presupuesto of presupuestosCompletos) {
        const nombreObra = presupuesto.nombreObra || presupuesto.direccionObra?.direccion || `Presupuesto #${presupuesto.numeroPresupuesto}`;
        const totalPresupuestoObra = calcularTotalPresupuestoObra(presupuesto);

        //  Sumar asignaciones de esta obra (cobros asignados)
        const asignacionesObra = todasLasAsignaciones.filter(a =>
          a.presupuestoNoClienteId === presupuesto.id || a.obraId === presupuesto.obraId
        );
        const asignacionesActivas = asignacionesObra.filter(a => a.estado === 'ACTIVA' || a.estado === 'activa');
        const cobradoObra = asignacionesActivas
          .reduce((sum, a) => sum + parseFloat(a.montoAsignado || 0), 0);

        //  Obtener pagos REALES de esta obra desde el endpoint de resumen financiero
        let pagadoObra = 0;
        let trabajosExtraObra = [];
        try {
          const obraId = presupuesto.obraId;
          if (obraId) {
            const resumen = await api.get(`/api/v1/obras-financiero/${obraId}/resumen`, { empresaId });
            pagadoObra = resumen.totalPagadoGeneral || 0;

            //  Agregar trabajos extra de esta obra
            const pagadoTrabajosExtraObra = pagosTrabajosExtraPorObra[obraId] || 0;
            pagadoObra += pagadoTrabajosExtraObra;

            //  Cargar trabajos extra de esta obra para el desglose
            try {
              const response = await api.trabajosExtra.getAll(empresaId, { obraId });
              const trabajos = Array.isArray(response) ? response : response?.data || [];

              trabajosExtraObra = await Promise.all(trabajos.map(async (trabajo) => {
                try {
                  const fullResponse = await api.trabajosExtra.getById(trabajo.id, empresaId);
                  const fullTrabajo = fullResponse.data || fullResponse;

                  //  EVITAR DUPLICADOS: Si el trabajo extra tiene presupuestoNoClienteId y ya fue contado, marcarlo
                  if (fullTrabajo.presupuestoNoClienteId && idsPresupuestosTrabajosExtra.includes(fullTrabajo.presupuestoNoClienteId)) {
                    console.log(`   [ObrasSeleccionadas] Trabajo extra "${fullTrabajo.nombre}" YA fue contado como presupuesto ${fullTrabajo.presupuestoNoClienteId}, marcado para omitir`);
                    return null; // Marcarlo para filtrarlo despus
                  }

                  // Calcular total del trabajo extra
                  let totalCalculado = 0;
                  const parseMontoLocal = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    let str = String(val).trim().replace(/[^0-9.,-]/g, '');
                    if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
                    return parseFloat(str) || 0;
                  };

                  if (fullTrabajo.itemsCalculadora && Array.isArray(fullTrabajo.itemsCalculadora) && fullTrabajo.itemsCalculadora.length > 0) {
                    let subtotalJornales = 0, subtotalMateriales = 0, subtotalOtros = 0;
                    fullTrabajo.itemsCalculadora.forEach((item) => {
                      let jorItem = parseMontoLocal(item.subtotalManoObra) || 0;
                      if (jorItem === 0 && item.jornales && Array.isArray(item.jornales)) {
                        jorItem = item.jornales.reduce((s, j) => s + (parseMontoLocal(j.subtotal) || parseMontoLocal(j.importe) || 0), 0);
                      }
                      subtotalJornales += jorItem;
                      subtotalMateriales += parseMontoLocal(item.subtotalMateriales) || 0;
                      subtotalOtros += parseMontoLocal(item.subtotalGastosGenerales) || 0;
                    });

                    const subtotalBase = subtotalJornales + subtotalMateriales + subtotalOtros;
                    let totalHonorarios = 0;
                    if (fullTrabajo.honorarios && typeof fullTrabajo.honorarios === 'object') {
                      const conf = fullTrabajo.honorarios;
                      if (conf.jornalesActivo && conf.jornalesValor) totalHonorarios += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                      if (conf.materialesActivo && conf.materialesValor) totalHonorarios += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                      if (conf.otrosCostosActivo && conf.otrosCostosValor) totalHonorarios += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                    }

                    let totalMC = 0;
                    if (fullTrabajo.mayoresCostos && typeof fullTrabajo.mayoresCostos === 'object') {
                      const conf = fullTrabajo.mayoresCostos;
                      if (conf.jornalesActivo && conf.jornalesValor) totalMC += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                      if (conf.materialesActivo && conf.materialesValor) totalMC += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                      if (conf.otrosCostosActivo && conf.otrosCostosValor) totalMC += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                      if (conf.honorariosActivo && conf.honorariosValor && totalHonorarios > 0) totalMC += totalHonorarios * (parseFloat(conf.honorariosValor) / 100);
                    }

                    totalCalculado = subtotalBase + totalHonorarios + totalMC;
                  } else {
                    totalCalculado = parseFloat(fullTrabajo.totalFinal) || parseFloat(fullTrabajo.montoTotal) || parseFloat(fullTrabajo.totalCalculado) || 0;
                  }

                  return {
                    ...fullTrabajo,
                    totalCalculado
                  };
                } catch (err) {
                  //  EVITAR DUPLICADOS: Verificar tambin en el catch
                  if (trabajo.presupuestoNoClienteId && idsPresupuestosTrabajosExtra.includes(trabajo.presupuestoNoClienteId)) {
                    console.log(`   [ObrasSeleccionadas] Trabajo extra ${trabajo.id} (error) YA fue contado como presupuesto ${trabajo.presupuestoNoClienteId}, omitiendo`);
                    return null;
                  }

                  return {
                    ...trabajo,
                    totalCalculado: parseFloat(trabajo.totalFinal) || parseFloat(trabajo.montoTotal) || parseFloat(trabajo.totalCalculado) || 0
                  };
                }
              }));

              //  Filtrar trabajos extra que ya fueron contados como presupuestos
              trabajosExtraObra = trabajosExtraObra.filter(te => te !== null);
            } catch (error) {
              console.warn(` Error cargando trabajos extra de obra ${obraId}:`, error);
            }
          }
        } catch (error) {
          console.error(` Error obteniendo pagos de obra ${presupuesto.id}:`, error);
          pagadoObra = 0;
        }

        desglosePorObra.push({
          id: presupuesto.id,
          obraId: presupuesto.obraId, //  Agregar obraId
          nombreObra,
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          estado: presupuesto.estado,
          totalPresupuesto: totalPresupuestoObra,
          totalCobrado: cobradoObra,
          totalPagado: pagadoObra, // Ya incluye trabajos extra
          saldoDisponible: cobradoObra - pagadoObra,
          cantidadCobros: asignacionesActivas.length,
          cantidadPagos: 0,
          cobrosPendientes: asignacionesObra.filter(a => a.estado === 'PENDIENTE' || a.estado === 'pendiente').length,
          pagosPendientes: 0,
          trabajosExtra: trabajosExtraObra //  Agregar trabajos extra al desglose
        });
      }

      // -----------------------------------------------------------------------
      // DESGLOSE OBRAS SIN PRESUPUESTO (OBRA_INDEPENDIENTE y TRABAJO_ADICIONAL)
      // Usando estadisticas del sistema unificado porque no tienen presupuesto vinculado
      // -----------------------------------------------------------------------
      for (const obra of obrasSinPresupuesto) {
        const nombreObra = obra.nombreObra || obra.nombre || `Entidad #${obra.id}`;
        const tipoEntidad = inferirTipoEntidad(obra);

        // La entidadId en la tabla original depende del tipo
        const entidadIdOriginal =
          tipoEntidad === 'OBRA_INDEPENDIENTE'
            ? (obra.obraId || obra.direccionObraId || obra.id)
            : obra.id;

        // Buscar estadisticas en el sistema unificado
        const statsEntidad = estadisticasUnificadas.find(
          ef => ef.tipoEntidad === tipoEntidad && ef.entidadId === entidadIdOriginal
        );

        desglosePorObra.push({
          id: obra.id,
          obraId: obra.obraId || obra.id,
          nombreObra,
          tipoEntidad,
          esObraIndependiente: obra.esObraIndependiente || false,
          esTrabajoAdicional: obra._esTrabajoAdicional || false,
          totalPresupuesto: statsEntidad?.presupuestoAprobado ?? 0,
          totalCobrado: statsEntidad?.totalCobrado ?? 0,
          totalPagado: statsEntidad?.totalGastos ?? 0,
          saldoDisponible: statsEntidad?.saldo ?? 0,
          cantidadCobros: 0,
          cantidadPagos: 0,
          cobrosPendientes: 0,
          pagosPendientes: 0,
          trabajosExtra: []
        });
      }

      //  Distribuir retiros generales proporcionalmente entre todas las obras
      const cantidadObras = desglosePorObra.length;
      const retiroGeneralPorObra = cantidadObras > 0 ? retirosGenerales / cantidadObras : 0;

      const desglosePorObraConSaldo = desglosePorObra.map(obra => {
        const retiradoObraEspecifico = retirosPorObra[obra.obraId] || 0;
        const retiradoObraTotal = retiradoObraEspecifico + retiroGeneralPorObra;
        const saldoDisponible = obra.totalCobrado - obra.totalPagado - retiradoObraTotal;
        return {
          ...obra,
          totalRetirado: retiradoObraTotal,
          saldoDisponible
        };
      });

      // Generar alertas
      const alertas = [];
      if (saldoDisponible < 0) {
        alertas.push({
          tipo: 'danger',
          icono: '',
          titulo: 'Dficit Financiero',
          mensaje: `Has pagado $${Math.abs(saldoDisponible).toLocaleString('es-AR')} ms de lo cobrado`,
          accion: 'Necesitas cobrar urgentemente'
        });
      }
      if (porcentajeCobrado < 50 && totalPresupuesto > 0) {
        alertas.push({
          tipo: 'warning',
          icono: '',
          titulo: 'Bajo Porcentaje de Cobro',
          mensaje: `Solo has cobrado el ${porcentajeCobrado.toFixed(1)}% del presupuesto total`,
          accion: 'Considera gestionar ms cobros'
        });
      }

      console.log(' [ObrasSeleccionadas] Datos cargados:', {
        profesionales: todosProfesionales.length,
        materiales: todosMateriales.length,
        otrosCostos: todosOtrosCostos.length,
        totalPresupuesto,
        totalCobrado,
        totalPagado,
        totalRetirado
      });

      setProfesionales(todosProfesionales);
      setMateriales(todosMateriales);
      setOtrosCostos(todosOtrosCostos);
      setEstadisticas({
        totalPresupuesto,
        totalCobrado, //  Siempre usar el total real de cobros (no asignaciones)
        totalCobradoEmpresa, //  Total cobrado a nivel empresa
        totalAsignado, //  Total asignado a rubros
        saldoCobradoSinAsignar: saldoDisponibleEmpresa, //  Cobrado sin asignar
        totalPagado,
        totalRetirado,
        saldoDisponible, //  Calculado con el total real
        porcentajeCobrado, //  Calculado con el total real
        porcentajePagado,
        porcentajeDisponible, //  Calculado con el total real
        cantidadObras: presupuestosSeleccionados.length,
        alertas,
        desglosePorObra: desglosePorObraConSaldo //  Usar versin con retiros distribuidos
      });

    } catch (err) {
      console.error(' [ObrasSeleccionadas] Error al cargar datos:', err);
      setError(err.message || 'Error al cargar datos de obras seleccionadas');
    } finally {
      setLoading(false);
    }
  }, [presupuestosSeleccionados, empresaId]);

  useEffect(() => {
    cargarDatosSeleccionados();
  }, [cargarDatosSeleccionados, refreshTrigger]);

  //  Escuchar eventos financieros para actualizar estadsticas automticamente
  useEffect(() => {
    if (!empresaId || !presupuestosSeleccionados || presupuestosSeleccionados.length === 0) return;

    let debounceTimer = null;

    const handleFinancialEvent = (eventData) => {
      console.log(' [useEstadisticasObrasSeleccionadas] Evento financiero recibido:', eventData);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        console.log(' [useEstadisticasObrasSeleccionadas] Recargando estadsticas...');
        cargarDatosSeleccionados();
      }, 500);
    };

    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.RETIRO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.RETIRO_ANULADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.RETIRO_ELIMINADO, handleFinancialEvent),
    ];

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribers.forEach(unsub => unsub());
    };
  }, [empresaId, presupuestosSeleccionados, cargarDatosSeleccionados]);

  return {
    profesionales,
    materiales,
    otrosCostos,
    estadisticas,
    loading,
    error,
    refetch: cargarDatosSeleccionados
  };
};
