import React, { useState, useEffect, useMemo } from 'react';
import apiService from '../services/api';
import { useEmpresa } from '../EmpresaContext';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { getTipoProfesionalBadgeClass, ordenarPorRubro } from '../utils/badgeColors';
import { esFeriado, esDiaHabil, contarDiasHabiles } from '../utils/feriadosArgentina';
import { listarPagosPorProfesional, registrarPago } from '../services/pagosProfesionalObraService';
import { registrarPagoConsolidado, listarPagosConsolidadosPorEmpresa } from '../services/pagosConsolidadosService';
import { obtenerTotalAdelantosActivos } from '../services/adelantosService';

/**
 * Modal para registrar pagos consolidados a múltiples profesionales de múltiples obras
 * ✨ Con sincronización automática vía EventBus
 * @param {Array} obrasSeleccionadas - Array de presupuestos seleccionados con checkbox
 */
const RegistrarPagoConsolidadoModal = ({
  show,
  onHide,
  onSuccess,
  obrasSeleccionadas = [],
  obrasOriginales = [], // ✅ Obras completas para detectar independientes
  refreshTrigger
}) => {
  const { empresaSeleccionada } = useEmpresa();

  // 📅 Función auxiliar para calcular número de semana desde fechaAsignacion
  const calcularNumeroSemanaDesde = (fechaAsignacion, fechaInicioObra) => {
    if (!fechaAsignacion || !fechaInicioObra) return null;

    try {
      const fechaAsig = new Date(fechaAsignacion);
      const fechaInicio = new Date(fechaInicioObra);

      // Calcular días transcurridos
      const diffTime = fechaAsig - fechaInicio;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Calcular número de semana (1-indexed)
      const numeroSemana = Math.floor(diffDays / 7) + 1;

      return numeroSemana > 0 ? numeroSemana : 1;
    } catch (error) {
      console.error('Error calculando semana:', error);
      return null;
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);
  const [todosLosProfesionales, setTodosLosProfesionales] = useState([]);
  const [todosMateriales, setTodosMateriales] = useState([]);
  const [todosOtrosCostos, setTodosOtrosCostos] = useState([]);
  const [gastosGenerales, setGastosGenerales] = useState([]); // 🔥 NUEVO: Catálogo de gastos generales
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState([]);
  const [otrosCostosSeleccionados, setOtrosCostosSeleccionados] = useState([]);
  const [tipoPago, setTipoPago] = useState('SEMANAL');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(0); // 0 = todas las semanas
  const [maxSemanas, setMaxSemanas] = useState(1);
  const [tabActiva, setTabActiva] = useState('PROFESIONALES'); // PROFESIONALES, MATERIALES, OTROS_COSTOS, TRABAJOS_ADICIONALES

  // 🆕 Estados para trabajos adicionales
  const [todosLosTrabajos, setTodosLosTrabajos] = useState([]);
  const [trabajosExtraSeleccionados, setTrabajosExtraSeleccionados] = useState([]);
  const [mostrarDetallesTrabajo, setMostrarDetallesTrabajo] = useState({}); // {trabajoId: true/false}

  // 🗓️ Estado para toggle de días trabajados (incluir/excluir feriados)
  const [mostrarSoloHabiles, setMostrarSoloHabiles] = useState(false); // false = mostrar todos los días, true = solo hábiles

  useEffect(() => {
    if (show && empresaSeleccionada) {
      console.log('🔄 [PagoConsolidado] Modal abierto, cargando datos...');
      // Resetear selecciones al abrir el modal para forzar recarga limpia
      setProfesionalesSeleccionados([]);
      setMaterialesSeleccionados([]);
      setOtrosCostosSeleccionados([]);
      setTrabajosExtraSeleccionados([]);
      cargarPresupuestosYProfesionales();
    }
  }, [show, empresaSeleccionada, obrasSeleccionadas, refreshTrigger]);

  // 🔄 Recargar datos adicional cuando cambian obras seleccionadas
  useEffect(() => {
    if (show && empresaSeleccionada && obrasSeleccionadas.length > 0) {
      console.log('🔄 [PagoConsolidado] Obras seleccionadas cambiaron, recargando...');
      cargarPresupuestosYProfesionales();
    }
  }, [JSON.stringify(obrasSeleccionadas.map(o => o.id))]);

  // 🔔 Escuchar eventos de pagos para actualizar automáticamente
  useEffect(() => {
    if (!show) {
      console.log('⏸️ [PagoConsolidado] Modal cerrado, no escuchando eventos');
      return;
    }

    console.log('🔔 [PagoConsolidado] Modal abierto, suscribiendo a eventos financieros...');

    // Escuchar pagos individuales
    const unsubscribePago = eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, (data) => {
      console.log('🔔✅ [PagoConsolidado] PAGO_REGISTRADO recibido, recargando...', data);
      cargarPresupuestosYProfesionales();
    });

    // Escuchar pagos consolidados (de este mismo modal u otros)
    const unsubscribePagoConsolidado = eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, (data) => {
      console.log('🔔✅ [PagoConsolidado] PAGO_CONSOLIDADO_REGISTRADO recibido, recargando...', data);
      cargarPresupuestosYProfesionales();
    });

    // Escuchar actualizaciones generales
    const unsubscribeActualizacion = eventBus.on(FINANCIAL_EVENTS.DATOS_FINANCIEROS_ACTUALIZADOS, (data) => {
      console.log('🔔✅ [PagoConsolidado] DATOS_FINANCIEROS_ACTUALIZADOS recibido, recargando...', data);
      cargarPresupuestosYProfesionales();
    });

    console.log('✅ [PagoConsolidado] Suscripciones activas para:', {
      PAGO_REGISTRADO: '✓',
      PAGO_CONSOLIDADO_REGISTRADO: '✓',
      DATOS_FINANCIEROS_ACTUALIZADOS: '✓'
    });

    // Cleanup: desuscribirse al desmontar
    return () => {
      unsubscribePago();
      unsubscribePagoConsolidado();
      unsubscribeActualizacion();
      console.log('❌ [PagoConsolidado] Desuscrito de eventos financieros');
    };
  }, [show, empresaSeleccionada]);

  const cargarPresupuestosYProfesionales = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Cargando presupuestos seleccionados para pago consolidado...', obrasSeleccionadas);

      // Si no hay obras seleccionadas, no hacer nada
      if (!obrasSeleccionadas || obrasSeleccionadas.length === 0) {
        setPresupuestos([]);
        setTodosLosProfesionales([]);
        setMaxSemanas(1);
        setLoading(false);
        return;
      }

      // 🔥 Deduplicar obras seleccionadas por ID
      const obrasSinDuplicados = obrasSeleccionadas.filter((obra, index, self) =>
        index === self.findIndex((o) => o.id === obra.id)
      );

      if (obrasSeleccionadas.length !== obrasSinDuplicados.length) {
        console.warn(`⚠️ Se encontraron ${obrasSeleccionadas.length - obrasSinDuplicados.length} obras duplicadas. Se eliminaron.`);
      }

      console.log(`✅ Obras únicas a procesar: ${obrasSinDuplicados.length}`);

      // Cargar datos completos de cada presupuesto seleccionado
      const presupuestosCompletos = await Promise.all(
        obrasSinDuplicados.map(async (obra) => {
          try {
            console.log('🔍 Cargando obra completa:', obra.id, obra);
            const completo = await apiService.presupuestosNoCliente.getById(obra.id, empresaSeleccionada.id);
            console.log('✅ Presupuesto completo recibido:', completo);
            return completo;
          } catch (error) {
            console.error(`Error cargando presupuesto ${obra.id}:`, error);
            return obra; // Devolver el básico si falla
          }
        })
      );

      // 🔥 Crear catálogo de gastos generales desde los presupuestos
      console.log('💰 Extrayendo catálogo de gastos generales desde itemsCalculadora...');

      const catalogoGastosGenerales = [];
      presupuestosCompletos.forEach((presupuesto, idx) => {
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.gastosGenerales && Array.isArray(item.gastosGenerales)) {
              item.gastosGenerales.forEach(gasto => {
                // Agregar al catálogo si no existe ya
                if (gasto.id && !catalogoGastosGenerales.find(gg => gg.id === gasto.id)) {
                  catalogoGastosGenerales.push({
                    id: gasto.id,
                    nombre: gasto.descripcion || gasto.nombre || `Gasto ${gasto.id}`,
                    descripcion: gasto.descripcion
                  });
                  console.log(`✅ Agregado al catálogo: ID ${gasto.id} - ${gasto.descripcion}`);
                }
              });
            }
          });
        }
      });
      setGastosGenerales(catalogoGastosGenerales);
      console.log(`✅ Extraídos ${catalogoGastosGenerales.length} gastos generales de presupuestos`);
      console.log('📋 Catálogo final:', catalogoGastosGenerales);

      // ✅ Deduplicar presupuestos por ID antes de establecer (evita duplicados)
      const presupuestosUnicos = presupuestosCompletos.filter((p, index, self) =>
        index === self.findIndex((t) => t.id === p.id)
      );

      if (presupuestosCompletos.length !== presupuestosUnicos.length) {
        console.warn(`⚠️ Se encontraron ${presupuestosCompletos.length - presupuestosUnicos.length} presupuestos duplicados. Se eliminaron.`);
      }

      setPresupuestos(presupuestosUnicos);

      // Calcular el máximo de semanas desde BD (asignaciones)
      console.log('📊 Consultando configuración de semanas desde BD...');
      console.log('📊 Presupuestos completos a revisar:', presupuestosCompletos.map(p => ({
        id: p.id,
        nombreObra: p.nombreObra,
        estado: p.estado
      })));

      // Importar el servicio para obtener asignaciones
      const { obtenerAsignacionesSemanalPorObra } = await import('../services/profesionalesObraService');

      // Consultar semanas objetivo desde BD (tabla: asignacion_semanal_profesional)
      const semanasPromises = presupuestosUnicos.map(async (presupuesto) => {
        try {
          // 🔑 IMPORTANTE: Usar obraId (no presupuesto.id)
          const obraId = presupuesto.obraId || presupuesto.obra_id;
          let numSemanas = 0;

          if (!obraId) {
            console.warn(`⚠️ Presupuesto ${presupuesto.id} no tiene obraId, usando 1 semana por defecto`);
            return 1;
          }

          // PRIORIDAD 1: Leer desde configuración de planificación (localStorage)
          // Esta es la configuración oficial establecida por el usuario en "Configurar Planificación"
          console.log(`📋 Intentando leer configuración de planificación para obra ${obraId}...`);
          try {
            const configGuardada = localStorage.getItem(`configuracionObra_${obraId}`);
            if (configGuardada) {
              const config = JSON.parse(configGuardada);
              console.log(`📋 Configuración encontrada para obra ${obraId}:`, config);
              if (config.semanasObjetivo) {
                numSemanas = parseInt(config.semanasObjetivo);
                console.log(`✅ [CONFIGURACIÓN DE PLANIFICACIÓN] Obra "${presupuesto.nombreObra}" (obraId: ${obraId}) tiene ${numSemanas} semanas`);
                return numSemanas;
              }
            } else {
              console.log(`⚠️ No existe configuración de planificación para obra ${obraId}`);
            }
          } catch (error) {
            console.warn('⚠️ Error leyendo configuración de planificación:', error);
          }

          // PRIORIDAD 2: Obtener desde las asignaciones de BD
          console.log(`🔍 Consultando BD para obra ${obraId} (presupuesto ${presupuesto.id})...`);
          const asignacionesResponse = await obtenerAsignacionesSemanalPorObra(obraId, empresaSeleccionada.id);
          const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : asignacionesResponse?.data || [];

          console.log(`📦 Asignaciones encontradas para obra ${obraId}:`, asignaciones.length);

          // Extraer semanas_objetivo de la primera asignación
          if (asignaciones.length > 0 && asignaciones[0].semanasObjetivo) {
            numSemanas = parseInt(asignaciones[0].semanasObjetivo);
            console.log(`✅ Obra "${presupuesto.nombreObra}" (obraId: ${obraId}) tiene ${numSemanas} semanas objetivo desde BD`);
            return numSemanas;
          }

          // PRIORIDAD 3: Calcular estimado desde presupuesto (días / 5)
          if (presupuesto.tiempoEstimadoTerminacion) {
            const diasEstimados = parseInt(presupuesto.tiempoEstimadoTerminacion);
            numSemanas = Math.ceil(diasEstimados / 5); // 5 días hábiles por semana
            console.log(`✅ Obra "${presupuesto.nombreObra}" calculó ${numSemanas} semanas desde tiempoEstimadoTerminacion (${diasEstimados} días)`);
            return numSemanas;
          }

          // PRIORIDAD 4: Calcular maximo de semanas basado en las asignaciones reales (si existen)
          if (asignaciones && asignaciones.length > 0) {
            let maxSemanaReal = 0;
            asignaciones.forEach(a => {
              if (a.asignacionesPorSemana && Array.isArray(a.asignacionesPorSemana)) {
                if (a.asignacionesPorSemana.length > maxSemanaReal) {
                  maxSemanaReal = a.asignacionesPorSemana.length;
                }
              }
            });

            if (maxSemanaReal > 0) {
              console.log(`✅ Obra "${presupuesto.nombreObra}" calculó ${maxSemanaReal} semanas desde asignaciones reales`);
              return maxSemanaReal;
            }
          }

          console.warn(`⚠️ Obra "${presupuesto.nombreObra}" (obraId: ${obraId}) NO tiene configuración de semanas, usando 6 por defecto`);
          return 6; // Default más realista que 1
        } catch (error) {
          console.error(`❌ Error obteniendo configuración de obra:`, error);
          return 6; // Default 6 semanas en caso de error
        }
      });

      const semanasArray = await Promise.all(semanasPromises);
      console.log('📊 Array de semanas obtenido desde BD:', semanasArray);
      const maximoSemanas = semanasArray.length > 0 ? Math.max(...semanasArray) : 1;

      setMaxSemanas(maximoSemanas);
      console.log(`✅ Máximo de semanas calculado: ${maximoSemanas} (de ${presupuestosCompletos.length} obras)`);

      // 🔥 CARGAR PROFESIONALES DESDE ASIGNACIONES DE OBRA (no del presupuesto)
      console.log('👷 Cargando profesionales asignados desde BD...');

      // Primero, cargar tabla de profesionales para obtener tarifas
      let profesionalesPorId = new Map();
      try {
        const todosProfesionales = await apiService.profesionales.getAll(empresaSeleccionada.id);
        const profesionalesArray = Array.isArray(todosProfesionales) ? todosProfesionales :
                                   todosProfesionales?.data || [];

        profesionalesArray.forEach(prof => {
          if (prof.id) {
            profesionalesPorId.set(prof.id, {
              id: prof.id,
              nombre: prof.nombre,
              tipo: prof.tipoProfesional,
              honorarioDia: prof.honorario_dia || prof.honorarioDia || 0,
              valorHoraDefault: prof.valorHoraDefault || prof.honorario_dia || prof.honorarioDia || 0
            });
          }
        });

        console.log(`💰 Cargados ${profesionalesPorId.size} profesionales con tarifas desde tabla profesionales`);
        if (profesionalesPorId.size > 0) {
          // Mostrar ejemplo de un profesional para debugging
          const ejemploProf = Array.from(profesionalesPorId.values())[0];
          console.log(`📋 Ejemplo profesional cargado:`, ejemploProf);
        }
      } catch (err) {
        console.error('❌ Error cargando profesionales:', err);
      }

      // Ahora cargar asignaciones de cada obra
      const profesionalesCargaPromises = presupuestosUnicos.map(async (presupuesto) => {
        try {
          const obraId = presupuesto.obraId || presupuesto.obra_id;
          if (!obraId) {
            console.warn(`⚠️ Presupuesto ${presupuesto.id} no tiene obraId`);
            return [];
          }

          console.log(`🔍 Cargando asignaciones de obra ${obraId} (presupuesto ${presupuesto.id})...`);
          const asignacionesResponse = await obtenerAsignacionesSemanalPorObra(obraId, empresaSeleccionada.id);
          const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse :
                              asignacionesResponse?.data || [];

          console.log(`📦 Asignaciones encontradas para obra ${obraId}:`, asignaciones.length);

          if (asignaciones.length === 0) {
            return [];
          }

          // Procesar asignaciones y agrupar por profesional
          const profesionalesMap = new Map();

          asignaciones.forEach((asignacion) => {
            const asignacionesPorSemana = asignacion.asignacionesPorSemana || [];

            asignacionesPorSemana.forEach((semana, semanaIdx) => {
              // El backend no envía numeroSemana, así que usamos el índice + 1
              const numeroSemana = semana.numeroSemana || semana.numero_semana || semana.semana || semana.semanaNumero || (semanaIdx + 1);
              const detalles = semana.detallesPorDia || [];

              detalles.forEach(detalle => {
                const profId = detalle.profesionalId;
                const key = `obra${obraId}-prof${profId}`;

                // 🗓️ Validar si el día es hábil (excluye feriados y fines de semana)
                const fechaDetalle = detalle.fecha;
                const esHabil = esDiaHabil(fechaDetalle);
                const esFeriadoDia = esFeriado(fechaDetalle);

                if (!esHabil) {
                  console.log(`⚠️ Día no hábil detectado: ${fechaDetalle} ${esFeriadoDia ? '(FERIADO)' : '(FIN DE SEMANA)'} - profesional ${profId}`);
                }

                if (!profesionalesMap.has(key)) {
                  // 🔥 IMPORTANTE: Usar tarifa de la asignación (histórica) NO la tarifa actual
                  const profesionalReal = profesionalesPorId.get(profId);
                  let importeJornal = 0;

                  // Prioridad 1: Tarifa guardada en la asignación (tarifa del momento de asignar)
                  if (detalle.importeJornal && detalle.importeJornal > 0) {
                    importeJornal = detalle.importeJornal;
                    console.log(`💰 ${detalle.profesionalNombre}: Usando tarifa de asignación $${importeJornal}`);
                  }
                  // Fallback: Si no hay tarifa en asignación, usar tarifa actual del profesional
                  else if (profesionalReal) {
                    // Intentar primero honorarioDia, luego valorHoraDefault
                    const tarifaProfesional = profesionalReal.honorarioDia || profesionalReal.valorHoraDefault || 0;
                    if (tarifaProfesional > 0) {
                      importeJornal = tarifaProfesional;
                      console.warn(`⚠️ ${detalle.profesionalNombre}: Asignación sin tarifa, usando tarifa del profesional $${importeJornal} (campo: ${profesionalReal.honorarioDia ? 'honorarioDia' : 'valorHoraDefault'})`);
                    }
                  }
                  // Último recurso: intentar obtener del profesionalTarifa si existe en detalle
                  if (importeJornal === 0 && detalle.profesionalTarifa && detalle.profesionalTarifa > 0) {
                    importeJornal = detalle.profesionalTarifa;
                    console.warn(`⚠️ ${detalle.profesionalNombre}: Usando profesionalTarifa de detalle $${importeJornal}`);
                  }

                  if (importeJornal === 0) {
                    console.error(`❌ ${detalle.profesionalNombre} (ID: ${profId}): Sin tarifa en ninguna fuente. Datos:`, {
                      detalleImporteJornal: detalle.importeJornal,
                      detalleProfesionalTarifa: detalle.profesionalTarifa,
                      profesionalReal: profesionalReal,
                      honorarioDia: profesionalReal?.honorarioDia,
                      valorHoraDefault: profesionalReal?.valorHoraDefault
                    });
                  }

                  profesionalesMap.set(key, {
                    asignacionId: asignacion.asignacionId,
                    profesionalId: profId,
                    profesionalObraId: detalle.profesionalObraId,
                    tipoProfesional: detalle.profesionalTipo || profesionalReal?.tipo || 'Sin tipo',
                    nombreProfesional: detalle.profesionalNombre || profesionalReal?.nombre || 'Sin nombre',
                    importePorJornal: importeJornal,
                    totalJornales: 0,
                    totalJornalesHabiles: 0, // 🔥 Contador solo de días hábiles
                    totalDiasFeriados: 0, // 🔥 Contador de feriados
                    presupuestoId: presupuesto.id,
                    obraId: obraId,
                    numeroPresupuesto: presupuesto.numeroPresupuesto,
                    nombreObra: presupuesto.nombreObra,
                    direccionObra: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim(),
                    semanas: [], // 🔥 Guardar desglose por semana
                    semanasTrabajadas: new Set() // 🔥 Set de números de semana
                  });
                }

                const prof = profesionalesMap.get(key);
                prof.totalJornales += 1;

                // 🗓️ Incrementar contadores según tipo de día
                if (esHabil) {
                  prof.totalJornalesHabiles += 1;
                } else if (esFeriadoDia) {
                  prof.totalDiasFeriados += 1;
                }

                // 🔥 Agregar información de semana
                prof.semanasTrabajadas.add(numeroSemana);

                // Buscar o crear entrada de semana
                let infoSemana = prof.semanas.find(s => s.numeroSemana === numeroSemana);
                if (!infoSemana) {
                  infoSemana = {
                    numeroSemana: numeroSemana,
                    diasTrabajados: 0,
                    diasHabiles: 0, // 🗓️ Solo días hábiles
                    diasFeriados: 0, // 🗓️ Feriados en esta semana
                    fechaInicio: detalle.fecha,
                    fechaFin: detalle.fecha
                  };
                  prof.semanas.push(infoSemana);
                }

                infoSemana.diasTrabajados += 1;

                // 🗓️ Contar días hábiles y feriados por semana
                if (esHabil) {
                  infoSemana.diasHabiles += 1;
                } else if (esFeriadoDia) {
                  infoSemana.diasFeriados += 1;
                }

                // Actualizar fechas
                if (detalle.fecha < infoSemana.fechaInicio) {
                  infoSemana.fechaInicio = detalle.fecha;
                }
                if (detalle.fecha > infoSemana.fechaFin) {
                  infoSemana.fechaFin = detalle.fecha;
                }
              });
            });
          });

          // Convertir mapa a array y convertir Set a Array
          let profesionalesObra = Array.from(profesionalesMap.values()).map(prof => ({
            ...prof,
            semanasTrabajadas: Array.from(prof.semanasTrabajadas), // Convertir Set a Array
            id: prof.asignacionId, // 🔥 Usar asignacionId numérico real
            profesionalObraId: prof.asignacionId, // 🔥 Para buscar pagos
            uniqueId: `obra${prof.obraId}-prof${prof.profesionalId}`,
            cantidadJornales: prof.totalJornales,
            precioJornal: prof.importePorJornal,
            precioTotal: prof.totalJornales * prof.importePorJornal,
            importeCalculado: prof.totalJornales * prof.importePorJornal,
            totalPagado: 0, // Se cargará a continuación
            saldo: prof.totalJornales * prof.importePorJornal,
            tipo: prof.tipoProfesional,
            nombre: prof.nombreProfesional,
            diasTrabajados: prof.totalJornales,
            tarifaPorDia: prof.importePorJornal
          }));

          // 💰 Cargar pagos previos de cada profesional
          console.log(`💰 Iniciando carga de pagos previos para ${profesionalesObra.length} profesionales...`);
          await Promise.all(profesionalesObra.map(async (prof, idx) => {
            try {
              const idParaBuscar = prof.asignacionId; // 🔥 Usar asignacionId numérico
              console.log(`💰 [${idx+1}/${profesionalesObra.length}] Buscando pagos de ${prof.nombre} (asignacionId: ${idParaBuscar})`);

              if (idParaBuscar && typeof idParaBuscar === 'number') {
                const pagos = await listarPagosPorProfesional(idParaBuscar, empresaSeleccionada.id);
                const pagosArray = Array.isArray(pagos) ? pagos : (pagos?.data || []);
                console.log(`  📋 ${prof.nombre}: Encontrados ${pagosArray.length} pago(s)`);

                // 🔥 SEPARAR pagos normales de adelantos
                const pagosSinAdelantos = pagosArray.filter(pago => !pago.esAdelanto);
                const adelantosSeparados = pagosArray.filter(pago => pago.esAdelanto);

                // 💰 Total Pagado = solo pagos consolidados normales (sin adelantos)
                const totalPagado = pagosSinAdelantos.reduce((sum, pago) => sum + (pago.montoFinal || pago.monto || 0), 0);

                // 💸 Adelantos Pendientes = suma de adelantos con saldoPendiente > 0
                const totalAdelantos = adelantosSeparados.reduce((sum, adelanto) => {
                  const saldoPendiente = adelanto.saldoAdelantoPorDescontar || adelanto.montoFinal || adelanto.monto || 0;
                  return sum + saldoPendiente;
                }, 0);

                prof.totalPagado = totalPagado;
                prof.adelantosPendientes = totalAdelantos;
                prof.saldo = prof.importeCalculado - totalPagado; // Saldo = lo que debe - pagos normales

                console.log(`  💰 ${prof.nombre}: Total=${prof.importeCalculado}, Pagos=${totalPagado} (${pagosSinAdelantos.length}), Adelantos=${totalAdelantos} (${adelantosSeparados.length}), Saldo=${prof.saldo}`);
              } else {
                console.warn(`  ⚠️ ${prof.nombre}: No tiene ID válido para buscar pagos`);
                prof.adelantosPendientes = 0;
              }
            } catch (err) {
              console.error(`  ❌ Error cargando pagos de ${prof.nombre}:`, err);
            }
          }));

          console.log(`✅ Procesados ${profesionalesObra.length} profesionales de obra ${obraId}`);
          if (profesionalesObra.length > 0) {
            console.log(`📋 EJEMPLO profesional de obra ${obraId}:`, {
              nombre: profesionalesObra[0].nombreProfesional,
              semanasTrabajadas: profesionalesObra[0].semanasTrabajadas,
              semanas: profesionalesObra[0].semanas,
              totalJornales: profesionalesObra[0].totalJornales
            });
          }
          return profesionalesObra;

        } catch (error) {
          console.error(`❌ Error cargando profesionales de obra:`, error);
          return [];
        }
      });

      const profesionalesPorObra = await Promise.all(profesionalesCargaPromises);
      const profesionales = profesionalesPorObra.flat();

      // 🗓️ Resumen de feriados detectados
      const totalFeriadosDetectados = profesionales.reduce((sum, p) => sum + (p.totalDiasFeriados || 0), 0);
      const profesionalesConFeriados = profesionales.filter(p => p.totalDiasFeriados > 0).length;

      console.log(`👷 ${profesionales.length} profesionales ASIGNADOS encontrados en total`);
      if (totalFeriadosDetectados > 0) {
        console.log(`🗓️ FERIADOS DETECTADOS: ${totalFeriadosDetectados} día(s) feriado en ${profesionalesConFeriados} profesional(es)`);
        console.log(`📊 Calendario de feriados aplicado correctamente`);
      } else {
        console.log(`✅ No se detectaron feriados en el período analizado`);
      }

      setTodosLosProfesionales(profesionales);

      // 🧱 CARGAR MATERIALES DESDE PRESUPUESTO (para "Todas las Semanas")
      console.log('🧱 Cargando materiales desde presupuestos...');
      const materialesArray = [];

      presupuestosUnicos.forEach((presupuesto) => {
        const obraId = presupuesto.obraId || presupuesto.obra_id;

        // Procesar materiales de itemsCalculadora
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.materialesLista && Array.isArray(item.materialesLista)) {
              // 🔍 LOG: Ver estructura del primer material
              if (item.materialesLista.length > 0) {
                console.log('🔍 ESTRUCTURA material del presupuesto:', {
                  objetoCompleto: item.materialesLista[0],
                  propiedades: Object.keys(item.materialesLista[0])
                });
              }

              item.materialesLista.forEach(mat => {
                // Buscar el nombre del material en múltiples campos posibles
                const nombreMaterial = mat.tipoMaterial || mat.tipo_material || mat.nombreMaterial || mat.nombre_material || mat.nombre || mat.descripcion || 'Material sin nombre';
                const key = `obra${obraId}-material${mat.id || nombreMaterial}`;
                const cantidad = parseFloat(mat.cantidad) || 0;

                // 🔥 Calcular precio unitario desde subtotal / cantidad
                const subtotal = parseFloat(mat.subtotal) || 0;
                const precioUnitario = cantidad > 0 ? (subtotal / cantidad) : 0;

                const total = cantidad * precioUnitario;

                // 🔍 Verificar que tenga itemId
                if (!item.id) {
                  console.warn(`⚠️ Material "${nombreMaterial}" del presupuesto NO tiene itemCalculadoraId. Item completo:`, item);
                }

                materialesArray.push({
                  uniqueId: key,
                  materialId: mat.id || null, // 🔥 ID del material en material_calculadora
                  itemId: item.id || null, // 🔥 ID del itemCalculadora
                  tipoMaterial: nombreMaterial,
                  cantidad: cantidad,
                  precioUnitario: precioUnitario,
                  importeCalculado: total,
                  totalPagado: 0,
                  saldo: total,
                  presupuestoId: presupuesto.id,
                  obraId: obraId,
                  numeroPresupuesto: presupuesto.numeroPresupuesto,
                  nombreObra: presupuesto.nombreObra,
                  direccionObra: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim()
                });
              });
            }
          });
        }
      });

      // 🧱 CARGAR MATERIALES ASIGNADOS A OBRAS (semanales)
      console.log('🧱 Cargando materiales asignados a obras desde BD...');
      const materialesAsignadosPromises = presupuestosUnicos.map(async (presupuesto) => {
        try {
          const obraId = presupuesto.obraId || presupuesto.obra_id;
          if (!obraId) return [];

          // Obtener materiales asignados desde /api/obras/{obraId}/materiales
          const response = await fetch(`http://localhost:8080/api/obras/${obraId}/materiales`, {
            headers: { 'empresaId': empresaSeleccionada.id.toString() }
          });

          if (!response.ok) {
            console.warn(`⚠️ No se pudieron cargar materiales de obra ${obraId}`);
            return [];
          }

          const materialesAsignados = await response.json();
          const materialesArray = Array.isArray(materialesAsignados) ? materialesAsignados : materialesAsignados?.data || [];

          console.log(`📦 Obra ${obraId}: ${materialesArray.length} materiales asignados desde BD`);
          console.log('🔍 RAW DATA - Materiales del backend:', materialesArray);

          // ⚠️ Si no hay materiales en BD, significa que no se han asignado aún
          if (materialesArray.length === 0) {
            console.warn(`⚠️ Obra ${obraId}: Sin materiales asignados en BD. Use "Asignar Materiales a Obra" para registrarlos.`);
          }

          const materialesFinales = materialesArray;
          // 🔍 Debug: Mostrar si los materiales traen información de semana
          if (materialesFinales.length > 0) {
            console.log('🔍 Ejemplo de material asignado:', {
              id: materialesFinales[0].id,
              presupuestoMaterialId: materialesFinales[0].presupuestoMaterialId, // 🔥 ID de material_calculadora
              materialCalculadoraId: materialesFinales[0].materialCalculadoraId,
              nombre: materialesFinales[0].nombreMaterial || materialesFinales[0].nombre,
              semana: materialesFinales[0].semana,
              numeroSemana: materialesFinales[0].numeroSemana,
              numero_semana: materialesFinales[0].numero_semana,
              fechaAsignacion: materialesFinales[0].fechaAsignacion,
              todasLasPropiedades: Object.keys(materialesFinales[0])
            });
          }

          return materialesFinales.map(mat => {
            // 🔥 Usar presupuestoMaterialId que viene del backend (ID en material_calculadora)
            const materialCalculadoraId = mat.presupuestoMaterialId || mat.materialCalculadoraId || mat.id;

            const cantidad = parseFloat(mat.cantidadAsignada || mat.cantidad) || 0;
            let precioUnitario = parseFloat(mat.precioUnitario || mat.precio) || 0;

            // 🔥 Si el precio unitario es 0, buscar en el presupuesto
            if (precioUnitario === 0) {
              console.log(`⚠️ Material asignado "${mat.nombreMaterial || mat.nombre}" sin precio, buscando en presupuesto...`);

              // Buscar en itemsCalculadora.materialesLista del presupuesto
              if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
                for (const item of presupuesto.itemsCalculadora) {
                  if (item.materialesLista && Array.isArray(item.materialesLista)) {
                    const materialEnPresupuesto = item.materialesLista.find(m => {
                      const nombreMat = m.nombre || m.tipoMaterial || m.nombreMaterial || '';
                      const nombreAsignado = mat.nombreMaterial || mat.nombre || mat.tipoMaterial || '';
                      return nombreMat.toLowerCase().includes(nombreAsignado.toLowerCase()) ||
                             nombreAsignado.toLowerCase().includes(nombreMat.toLowerCase());
                    });

                    if (materialEnPresupuesto) {
                      const subtotal = parseFloat(materialEnPresupuesto.subtotal) || 0;
                      const cantidadPresupuesto = parseFloat(materialEnPresupuesto.cantidad) || 1;
                      precioUnitario = cantidadPresupuesto > 0 ? (subtotal / cantidadPresupuesto) : 0;

                      if (precioUnitario > 0) {
                        console.log(`✅ Precio encontrado: $${precioUnitario} (subtotal ${subtotal} / cantidad ${cantidadPresupuesto})`);
                        break;
                      }
                    }
                  }
                }
              }

              if (precioUnitario === 0) {
                console.warn(`❌ No se encontró precio para material "${mat.nombreMaterial || mat.nombre}"`);
              }
            }

            const total = cantidad * precioUnitario;

            // Extraer información de semana si está disponible
            let semanaAsignacion = mat.semana || mat.numeroSemana || mat.numero_semana || null;

            // Si no viene del backend pero hay fechaAsignacion, calcularla
            if (semanaAsignacion === null && mat.fechaAsignacion && presupuesto.fechaInicioObra) {
              semanaAsignacion = calcularNumeroSemanaDesde(mat.fechaAsignacion, presupuesto.fechaInicioObra);
              console.log(`📅 Material "${mat.nombreMaterial || mat.nombre}": semana calculada=${semanaAsignacion} desde fecha ${mat.fechaAsignacion}`);
            }

            return {
              uniqueId: `obra${obraId}-matAsignado${mat.id}`,
              materialId: materialCalculadoraId, // 🔥 ID correcto de material_calculadora
              tipoMaterial: mat.nombreMaterial || mat.nombre || mat.tipoMaterial || mat.descripcion || mat.tipo_material || 'Sin nombre',
              cantidad: cantidad,
              precioUnitario: precioUnitario,
              importeCalculado: total,
              totalPagado: 0,
              saldo: total,
              presupuestoId: presupuesto.id,
              obraId: obraId,
              numeroPresupuesto: presupuesto.numeroPresupuesto,
              nombreObra: presupuesto.nombreObra,
              direccionObra: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim(),
              semanaAsignacion: semanaAsignacion, // 🔥 NUEVO: semana de asignación
              fechaAsignacion: mat.fechaAsignacion || null, // 🔥 NUEVO: fecha de asignación
              materialOriginal: mat // 🔥 DEBUG: guardar el objeto original para inspección
            };
          }).filter(mat => {
            // 🔍 LOG: Materiales sin nombre para debugging
            if (mat.tipoMaterial === 'Sin nombre') {
              console.warn(`⚠️ Material sin nombre detectado:`, {
                materialId: mat.materialId,
                uniqueId: mat.uniqueId,
                objetoOriginal: mat.materialOriginal,
                propiedadesDisponibles: mat.materialOriginal ? Object.keys(mat.materialOriginal) : []
              });
            }
            return true; // No filtrar, mostrar todos
          });
        } catch (error) {
          console.error(`❌ Error cargando materiales de obra:`, error);
          return [];
        }
      });

      const materialesAsignadosArrays = await Promise.all(materialesAsignadosPromises);
      const materialesAsignados = materialesAsignadosArrays.flat();

      // 🔍 Debug: Mostrar si los materiales asignados traen numeroSemana
      if (materialesAsignados.length > 0) {
        console.log('🔍 DEBUG - Materiales asignados con info de semana:', materialesAsignados.slice(0, 5).map(m => ({
          id: m.materialId,
          nombre: m.tipoMaterial,
          uniqueId: m.uniqueId,
          semanaAsignacion: m.semanaAsignacion,
          fechaAsignacion: m.fechaAsignacion,
          cantidad: m.cantidad
        })));
      }

      // Combinar materiales del presupuesto + materiales asignados
      const todosLosMateriales = [...materialesArray, ...materialesAsignados];

      console.log(`🧱 Total materiales: ${todosLosMateriales.length} (${materialesArray.length} del presupuesto + ${materialesAsignados.length} asignados)`);

      // 🔍 Debug: Mostrar muestra de materiales cargados
      if (todosLosMateriales.length > 0) {
        console.log('📋 Muestra de materiales cargados:', todosLosMateriales.slice(0, 3).map(m => ({
          nombre: m.tipoMaterial,
          uniqueId: m.uniqueId,
          semanaAsignacion: m.semanaAsignacion,
          cantidad: m.cantidad,
          precio: m.precioUnitario,
          total: m.importeCalculado,
          obra: m.nombreObra
        })));
      }

      setTodosMateriales(todosLosMateriales);

      // 📋 CARGAR OTROS COSTOS - DESDE PRESUPUESTO (para mostrar en "Todas las Semanas")
      console.log('📋 Cargando otros costos desde presupuesto y asignaciones BD...');

      // 🔥 Cargar otros costos del presupuesto desde itemsCalculadora[].gastosGenerales[]
      const otrosCostosArray = presupuestosUnicos.flatMap((presupuesto) => {
        const gastosGenerales = [];

        // Extraer gastos generales de itemsCalculadora (filtrar presupuestos globales)
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.gastosGenerales && Array.isArray(item.gastosGenerales)) {
              // 🔍 LOG: Ver estructura del primer gasto
              if (item.gastosGenerales.length > 0) {
                console.log('🔍 ESTRUCTURA gasto general:', {
                  objetoCompleto: item.gastosGenerales[0],
                  propiedades: Object.keys(item.gastosGenerales[0])
                });
              }
              // ✅ Filtrar gastos que son presupuestos globales (no son gastos reales a pagar)
              const gastosReales = item.gastosGenerales.filter(g =>
                !g.descripcion || !g.descripcion.includes('Presupuesto Global Gastos Grales.')
              );
              gastosGenerales.push(...gastosReales.map(g => ({
                ...g,
                itemCalculadoraId: item.id // 🔥 Agregar itemId al gasto
              })));
            }
          });
        }

        console.log(`📦 Presupuesto ${presupuesto.id}: ${gastosGenerales.length} gastos generales encontrados`);

        return gastosGenerales.map(gasto => ({
          uniqueId: `presupuesto${presupuesto.id}-costo${gasto.id}`,
          costoId: gasto.id, // ID en la tabla de gastos generales de la calculadora
          gastoGeneralCalculadoraId: gasto.id, // 🔥 Mismo ID para el backend
          itemId: gasto.itemCalculadoraId || null, // 🔥 ID del itemCalculadora
          descripcion: gasto.descripcion || gasto.nombre || `Gasto General ID: ${gasto.id}`,
          importe: gasto.subtotal || 0, // 🔥 Usar subtotal en lugar de importe
          importeCalculado: gasto.subtotal || 0,
          totalPagado: 0,
          saldo: gasto.subtotal || 0,
          presupuestoId: presupuesto.id,
          obraId: presupuesto.obraId || presupuesto.obra_id,
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          nombreObra: presupuesto.nombreObra,
          direccionObra: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim(),
          esDelPresupuesto: true, // 🔥 Flag para identificar que viene del presupuesto
          semanaAsignacion: null // Sin semana asignada
        }));
      });

      console.log(`📦 Otros costos del presupuesto: ${otrosCostosArray.length}`);

      // 📋 CARGAR OTROS COSTOS ASIGNADOS A OBRAS (semanales)
      console.log('📋 Cargando otros costos asignados a obras desde BD...');
      const otrosCostosAsignadosPromises = presupuestosUnicos.map(async (presupuesto) => {
        try {
          const obraId = presupuesto.obraId || presupuesto.obra_id;
          if (!obraId) return [];

          // Obtener otros costos asignados desde /api/obras/{obraId}/otros-costos
          const response = await fetch(`http://localhost:8080/api/obras/${obraId}/otros-costos`, {
            headers: { 'empresaId': empresaSeleccionada.id.toString() }
          });

          if (!response.ok) {
            console.warn(`⚠️ No se pudieron cargar otros costos de obra ${obraId}`);
            return [];
          }

          const costosAsignados = await response.json();
          const costosArray = Array.isArray(costosAsignados) ? costosAsignados : costosAsignados?.data || [];

          console.log(`📦 Obra ${obraId}: ${costosArray.length} otros costos asignados desde BD`);

          // ⚠️ Si no hay costos en BD, significa que no se han asignado aún
          if (costosArray.length === 0) {
            console.warn(`⚠️ Obra ${obraId}: Sin gastos asignados en BD. Use "Asignar Otros Costos" para registrarlos.`);
          }

          const costosFinales = costosArray;
          if (costosFinales.length > 0) {
            console.log(`🔍 DEBUG - Todos los costos asignados de obra ${obraId}:`, costosFinales.map(c => ({
              id: c.id,
              descripcion: c.descripcion || c.nombre || c.nombreOtroCosto || 'Sin descripción',
              nombreGastoGeneral: c.nombreGastoGeneral,
              nombreCosto: c.nombreCosto,
              nombreOtroCosto: c.nombreOtroCosto,
              categoria: c.categoria,
              gastoGeneralId: c.gastoGeneralId,
              gastoGeneral: c.gastoGeneral,
              importe: c.importeAsignado || c.importe,
              semana: c.semana,
              semanaAsignacion: c.semanaAsignacion,
              numeroSemana: c.numeroSemana,
              fechaAsignacion: c.fechaAsignacion,
              todasLasPropiedades: Object.keys(c)
            })));
          }

          return costosFinales.map(costo => {
            const importe = parseFloat(costo.importeAsignado || costo.importe) || 0;

            // 🔥 LOG: Verificar qué campos vienen del backend
            console.log(`💰 Procesando costo ID ${costo.id}:`, {
              importeAsignado: costo.importeAsignado,
              importe: costo.importe,
              importeFinal: importe,
              todasLasPropiedades: Object.keys(costo),
              objetoCompleto: costo
            });

            // Extraer información de semana si está disponible
            let semanaAsignacion = costo.semana || costo.numeroSemana || costo.numero_semana || null;

            // Si no viene del backend pero hay fechaAsignacion, calcularla
            const fechaInicio = presupuesto.fechaInicio || presupuesto.fechaInicioObra || presupuesto.obra?.fechaInicio;
            if (semanaAsignacion === null && costo.fechaAsignacion && fechaInicio) {
              semanaAsignacion = calcularNumeroSemanaDesde(costo.fechaAsignacion, fechaInicio);
              console.log(`📅 Costo "${costo.descripcion || costo.nombre}": semana calculada=${semanaAsignacion} desde fecha ${costo.fechaAsignacion}, fechaInicio=${fechaInicio}`);
            }

            // 🔥 Buscar nombre/descripción del gasto general en múltiples campos
            let descripcionGasto = costo.descripcion
              || costo.nombre
              || costo.nombreGastoGeneral
              || costo.nombreCosto
              || costo.categoria
              || (costo.gastoGeneral && costo.gastoGeneral.nombre)
              || (costo.gastoGeneral && costo.gastoGeneral.descripcion);

            // Si la descripción es genérica "Gasto General ID: XXX", buscar en catálogo
            if (descripcionGasto && descripcionGasto.includes('Gasto General ID:') && costo.gastoGeneralId) {
              console.log(`🔍 Buscando nombre para gastoGeneralId ${costo.gastoGeneralId} (tipo: ${typeof costo.gastoGeneralId}) en catálogo de ${catalogoGastosGenerales.length} gastos...`);
              console.log(`🔍 Catálogo completo:`, catalogoGastosGenerales.map(gg => ({ id: gg.id, tipo: typeof gg.id, nombre: gg.nombre })));

              const gastoGeneralEnCatalogo = catalogoGastosGenerales.find(gg => gg.id == costo.gastoGeneralId); // 🔥 Usar == en lugar de === para comparar sin tipo
              if (gastoGeneralEnCatalogo) {
                console.log(`✅ Encontrado: ${gastoGeneralEnCatalogo.nombre || gastoGeneralEnCatalogo.descripcion}`);
                descripcionGasto = gastoGeneralEnCatalogo.nombre || gastoGeneralEnCatalogo.descripcion || descripcionGasto;
              } else {
                console.warn(`❌ No encontrado gastoGeneralId ${costo.gastoGeneralId} en catálogo`);
              }
            } else if (!descripcionGasto || descripcionGasto.includes('Gasto General ID:')) {
              // Si la descripción sigue siendo genérica o no existe, buscar en catálogo de todos modos
              console.log(`🔍 Descripción genérica o vacía, buscando gastoGeneralId ${costo.gastoGeneralId} en catálogo...`);
              const gastoGeneralEnCatalogo = catalogoGastosGenerales.find(gg => gg.id == costo.gastoGeneralId);
              if (gastoGeneralEnCatalogo) {
                console.log(`✅ Encontrado en catálogo: ${gastoGeneralEnCatalogo.nombre}`);
                descripcionGasto = gastoGeneralEnCatalogo.nombre || gastoGeneralEnCatalogo.descripcion || descripcionGasto;
              }
            }

            return {
              uniqueId: `obra${obraId}-costoAsignado${costo.id}`,
              costoId: costo.id, // ID de la asignación
              gastoGeneralCalculadoraId: costo.gastoGeneralId || costo.gasto_general_id || null, // 🔥 ID del gasto en la calculadora
              itemId: costo.itemCalculadoraId || null, // 🔥 ID del item de la calculadora
              descripcion: descripcionGasto,
              importe: importe,
              importeCalculado: importe,
              totalPagado: 0,
              saldo: importe,
              presupuestoId: presupuesto.id,
              obraId: obraId,
              numeroPresupuesto: presupuesto.numeroPresupuesto,
              nombreObra: presupuesto.nombreObra,
              direccionObra: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim(),
              semanaAsignacion: semanaAsignacion, // 🔥 NUEVO: semana de asignación
              fechaAsignacion: costo.fechaAsignacion || null // 🔥 NUEVO: fecha de asignación
            };
          });
        } catch (error) {
          console.error(`❌ Error cargando otros costos de obra:`, error);
          return [];
        }
      });

      const otrosCostosAsignadosArrays = await Promise.all(otrosCostosAsignadosPromises);
      const otrosCostosAsignados = otrosCostosAsignadosArrays.flat();

      // 🔍 Debug: Mostrar si los otros costos asignados traen numeroSemana
      if (otrosCostosAsignados.length > 0) {
        console.log('🔍 DEBUG - TODOS los otros costos asignados con info de semana:', otrosCostosAsignados.map(c => ({
          id: c.costoId,
          descripcion: c.descripcion,
          uniqueId: c.uniqueId,
          semanaAsignacion: c.semanaAsignacion,
          fechaAsignacion: c.fechaAsignacion,
          importe: c.importe
        })));
      }

      // Combinar otros costos del presupuesto + otros costos asignados
      const todosLosOtrosCostos = [...otrosCostosArray, ...otrosCostosAsignados];

      console.log(`📋 Total otros costos: ${todosLosOtrosCostos.length} (${otrosCostosArray.length} del presupuesto + ${otrosCostosAsignados.length} asignados)`);

      // 🔍 Debug: Mostrar resumen de semanas en otros costos
      const costosConSemana = todosLosOtrosCostos.filter(c => c.semanaAsignacion !== null && c.semanaAsignacion !== undefined);
      const costosSinSemana = todosLosOtrosCostos.filter(c => c.semanaAsignacion === null || c.semanaAsignacion === undefined);
      console.log(`📊 Otros costos con semana: ${costosConSemana.length}, sin semana: ${costosSinSemana.length}`);
      if (costosConSemana.length > 0) {
        console.log('   Semanas encontradas:', [...new Set(costosConSemana.map(c => c.semanaAsignacion))].sort());
      }

      setTodosOtrosCostos(todosLosOtrosCostos);

      // 🔧 CARGAR TRABAJOS EXTRA DE LAS OBRAS (obras con trabajos extra)
      const trabajosExtraCargados = await cargarTrabajosExtra(presupuestosUnicos);

      // 🔧 CARGAR TRABAJOS ADICIONALES DE LAS OBRAS (trabajos adicionales + obras independientes)
      const trabajosAdicionalesCargados = await cargarTrabajosAdicionales(presupuestosUnicos);

      // 💰 CARGAR PAGOS CONSOLIDADOS EXISTENTES (materiales, gastos generales Y trabajos adicionales)
      console.log('💰 Cargando pagos consolidados existentes para calcular totalPagado...');
      try {
        // Cargar pagos consolidados (materiales y gastos)
        const pagosConsolidados = await listarPagosConsolidadosPorEmpresa(empresaSeleccionada.id);
        console.log(`✅ Cargados ${pagosConsolidados.length} pagos consolidados de la empresa`);

        // Cargar pagos de trabajos extra
        const pagosTrabajosExtraResponse = await apiService.pagosTrabajoExtra.getByEmpresa(empresaSeleccionada.id);
        const pagosTrabajosExtraData = pagosTrabajosExtraResponse.data || pagosTrabajosExtraResponse || [];
        console.log(`✅ Cargados ${pagosTrabajosExtraData.length} pagos de trabajos extra de la empresa`);

        // Combinar todos los pagos
        const todosLosPagos = [...pagosConsolidados, ...pagosTrabajosExtraData];

        // Filtrar solo pagos válidos (PAGADO, no ANULADO)
        const pagosValidos = todosLosPagos.filter(p => p.estado === 'PAGADO');
        console.log(`✅ ${pagosValidos.length} pagos en estado PAGADO`);

        // 🧱 Mapear pagos a MATERIALES
        const pagosMateriales = pagosValidos.filter(p => p.tipoPago === 'MATERIALES');
        console.log(`🧱 ${pagosMateriales.length} pagos de materiales encontrados`);

        // 🔍 Debug: Ver estructura completa de pagos de materiales
        if (pagosMateriales.length > 0) {
          console.log('🔍 PAGOS DE MATERIALES CARGADOS:', pagosMateriales.map(p => ({
            id: p.id,
            materialCalculadoraId: p.materialCalculadoraId,
            itemCalculadoraId: p.itemCalculadoraId,
            presupuestoNoClienteId: p.presupuestoNoClienteId,
            monto: p.monto,
            concepto: p.concepto
          })));
        }

        // 🔍 Debug: Ver estructura de pagos y materiales
        if (pagosMateriales.length > 0 && todosLosMateriales.length > 0) {
          console.log('🔍 PRIMER PAGO de material:', pagosMateriales[0]);
          console.log('🔍 PRIMER MATERIAL cargado:', {
            materialId: todosLosMateriales[0].materialId,
            itemId: todosLosMateriales[0].itemId,
            presupuestoId: todosLosMateriales[0].presupuestoId,
            nombre: todosLosMateriales[0].tipoMaterial
          });
          console.log('🔍 TODOS LOS MATERIALES:', todosLosMateriales.map(m => ({
            tipoMaterial: m.tipoMaterial,
            materialId: m.materialId,
            itemId: m.itemId,
            presupuestoId: m.presupuestoId
          })));
        }

        todosLosMateriales.forEach(mat => {
          // Buscar pagos relacionados con este material
          const pagosDelMaterial = pagosMateriales.filter(p => {
            // Match por materialCalculadoraId y presupuestoId (obligatorios)
            const matchMaterial = p.materialCalculadoraId === mat.materialId;
            const matchPresupuesto = p.presupuestoNoClienteId === mat.presupuestoId;

            // Match flexible de itemCalculadoraId (puede ser null/undefined en ambos lados)
            const matchItem =
              p.itemCalculadoraId === mat.itemId || // Match exacto
              (p.itemCalculadoraId == null && mat.itemId == null); // Ambos null/undefined

            return matchMaterial && matchPresupuesto && matchItem;
          });

          console.log(`🔍 Buscando pagos para material "${mat.tipoMaterial}":`, {
            materialId: mat.materialId,
            itemId: mat.itemId,
            presupuestoId: mat.presupuestoId,
            pagosEncontrados: pagosDelMaterial.length
          });

          if (pagosDelMaterial.length > 0) {
            const totalPagado = pagosDelMaterial.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
            mat.totalPagado = totalPagado;
            mat.saldo = mat.importeCalculado - totalPagado;
            console.log(`💰 Material "${mat.tipoMaterial}": ${pagosDelMaterial.length} pago(s) = $${totalPagado}, saldo = $${mat.saldo}`);
          } else {
            console.log(`⚠️ Material "${mat.tipoMaterial}": NO se encontraron pagos`);
          }
        });

        const materialesConPagos = todosLosMateriales.filter(m => m.totalPagado > 0);
        console.log(`✅ ${materialesConPagos.length} materiales con pagos mapeados`);
        if (materialesConPagos.length > 0) {
          console.log('📋 Materiales con pagos:', materialesConPagos.map(m => ({
            nombre: m.tipoMaterial,
            totalPagado: m.totalPagado,
            saldo: m.saldo
          })));
        }

        // 📋 Mapear pagos a OTROS COSTOS (GASTOS_GENERALES)
        const pagosGastos = pagosValidos.filter(p => p.tipoPago === 'GASTOS_GENERALES');
        console.log(`📋 ${pagosGastos.length} pagos de gastos generales encontrados`);

        todosLosOtrosCostos.forEach(costo => {
          // Buscar pagos relacionados con este gasto
          const pagosDelCosto = pagosGastos.filter(p =>
            p.itemCalculadoraId === costo.itemId &&
            p.presupuestoNoClienteId === costo.presupuestoId
          );

          if (pagosDelCosto.length > 0) {
            const totalPagado = pagosDelCosto.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
            costo.totalPagado = totalPagado;
            costo.saldo = costo.importeCalculado - totalPagado;
          }
        });

        const costosConPagos = todosLosOtrosCostos.filter(c => c.totalPagado > 0);
        if (costosConPagos.length > 0) {
          console.log(`✅ ${costosConPagos.length} otros costos con pagos existentes`);
        }

        // 🔧 Mapear pagos a TRABAJOS EXTRA
        const pagosTrabajosExtra = pagosValidos.filter(p =>
          p.tipoPago === 'PAGO_GENERAL' && p.trabajoExtraId != null
        );
        console.log(`🔧 ${pagosTrabajosExtra.length} pagos de trabajos extra encontrados`);

        if (pagosTrabajosExtra.length > 0) {
          console.log('🔍 PAGOS DE TRABAJOS EXTRA:', pagosTrabajosExtra.map(p => ({
            id: p.id,
            trabajoExtraId: p.trabajoExtraId,
            monto: p.monto || p.montoFinal,
            concepto: p.concepto
          })));
        }

        console.log('🔍 TRABAJOS EXTRA CARGADOS para mapeo:', trabajosExtraCargados.length);

        trabajosExtraCargados.forEach(trabajo => {
          // Buscar pagos relacionados con este trabajo extra
          const pagosDelTrabajo = pagosTrabajosExtra.filter(p =>
            p.trabajoExtraId === trabajo.id
          );

          if (pagosDelTrabajo.length > 0) {
            const totalPagado = pagosDelTrabajo.reduce((sum, p) =>
              sum + (parseFloat(p.monto) || parseFloat(p.montoFinal) || 0), 0
            );
            trabajo.totalPagado = totalPagado;
            trabajo.saldo = trabajo.totalCalculado - totalPagado;
            trabajo.estadoPago = totalPagado >= trabajo.totalCalculado ? 'PAGADO_TOTAL' :
                                 totalPagado > 0 ? 'PAGADO_PARCIAL' : 'PENDIENTE';
            console.log(`💰 Trabajo extra "${trabajo.nombre}": ${pagosDelTrabajo.length} pago(s) = $${totalPagado}, saldo = $${trabajo.saldo}, estadoPago = ${trabajo.estadoPago}`);
          } else {
            console.log(`⚠️ Trabajo extra "${trabajo.nombre}": NO se encontraron pagos`);
          }
        });

        const trabajosConPagos = trabajosExtraCargados.filter(t => t.totalPagado > 0);
        if (trabajosConPagos.length > 0) {
          console.log(`✅ ${trabajosConPagos.length} trabajos extra con pagos existentes`);
        }

        // 🔄 Combinar trabajos extra + trabajos adicionales y actualizar el estado
        const todosCombinados = [...trabajosExtraCargados, ...trabajosAdicionalesCargados];
        console.log(`📊 Total de trabajos combinados: ${todosCombinados.length} (${trabajosExtraCargados.length} extras + ${trabajosAdicionalesCargados.length} adicionales)`);
        setTodosLosTrabajos(todosCombinados);

        console.log('✅ Pagos consolidados mapeados correctamente a materiales, otros costos y trabajos extra');

      } catch (error) {
        console.error('❌ Error cargando pagos consolidados:', error);
        // No fallar la carga completa por esto, solo loguear
      }

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      setError('Error al cargar los presupuestos y profesionales');
    } finally {
      setLoading(false);
    }
  };

  // 🔧 Función para cargar trabajos extra de las obras
  const cargarTrabajosExtra = async (presupuestos) => {
    console.log('�🚀🚀 ======= INICIO cargarTrabajosExtra ======= ');
    console.log('🚀🚀🚀 Presupuestos recibidos:', presupuestos.length);
    console.log('�🔧 Cargando trabajos extra de las obras seleccionadas...');

    try {
      const trabajosPromises = presupuestos.map(async (presupuesto) => {
        try {
          const obraId = presupuesto.obraId || presupuesto.obra_id;
          if (!obraId) return [];

          // Llamar al endpoint de trabajos extra
          const response = await apiService.trabajosExtra.getAll(empresaSeleccionada.id, { obraId });
          let trabajos = Array.isArray(response) ? response : response?.data || [];

          console.log(`�🚀🚀 Obra ${obraId}: ${trabajos.length} trabajo(s) extra encontrado(s) en BD`);
          console.log(`�🔧 Obra ${obraId}: ${trabajos.length} trabajo(s) extra encontrado(s) en BD`);

          // ⚠️ Si no hay trabajos en BD, significa que no se han creado aún
          if (trabajos.length === 0) {
            console.warn(`⚠️ Obra ${obraId}: Sin trabajos extra en BD. Use "Gestionar Trabajos Extra" para crearlos.`);
          }

          // Enriquecer cada trabajo con datos de la obra y resumen de pagos
          const trabajosConPagos = await Promise.all(trabajos.map(async (trabajoBase) => {
            let trabajo = trabajoBase;

            // 🔥 Si es un presupuesto global pero faltan los itemsCalculadora, cargar detalle completo
            if ((!trabajo.itemsCalculadora || trabajo.itemsCalculadora.length === 0) && trabajo.tipoPresupuesto === 'GLOBAL') {
              try {
                console.log(`🔧 Cargando detalle completo del trabajo extra ${trabajo.id} para obtener itemsCalculadora...`);
                const fullResponse = await apiService.trabajosExtra.getById(trabajo.id, empresaSeleccionada.id);
                const fullTrabajo = fullResponse.data || fullResponse;

                if (fullTrabajo && fullTrabajo.itemsCalculadora) {
                   trabajo = { ...trabajoBase, ...fullTrabajo };
                   console.log(`✅ Detalle cargado: ${fullTrabajo.itemsCalculadora.length} items encontrados`);
                }
              } catch (err) {
                console.warn(`⚠️ Error cargando detalle de trabajo extra ${trabajo.id}:`, err);
              }
            } else if (!trabajo.itemsCalculadora && !trabajo.profesionales?.length && !trabajo.tareas?.length) {
               // Intento general de carga si parece vacío
               try {
                  const fullResponse = await apiService.trabajosExtra.getById(trabajo.id, empresaSeleccionada.id);
                  const fullTrabajo = fullResponse.data || fullResponse;
                  if (fullTrabajo) trabajo = { ...trabajoBase, ...fullTrabajo };
               } catch (e) {
                  // ignore
               }
            }

            // --- 1. Calcular Total desde Items Calculadora (Lógica completa tipo Presupuesto) ---
            let totalDesdeItems = 0;

            if (trabajo.itemsCalculadora && Array.isArray(trabajo.itemsCalculadora) && trabajo.itemsCalculadora.length > 0) {
              try {
                const parseMontoLocal = (val) => {
                   if (typeof val === 'number') return val;
                   if (!val) return 0;
                   let str = String(val).trim();

                   // Sanitizar: Dejar solo números, comas, puntos y signo menos
                   str = str.replace(/[^0-9.,-]/g, '');

                   // Detectar formato local (punto miles, coma decimal)
                   if (str.includes(',')) {
                      str = str.replace(/\./g, ''); // Quitar puntos de miles
                      str = str.replace(',', '.'); // Cambiar coma decimal a punto
                   }

                   return parseFloat(str) || 0;
                };

                // Calcular el Costo Directo (Suma de items)
                const subtotalCostoDirecto = trabajo.itemsCalculadora.reduce((sum, item, idx) => {
                  // 1. Intentar usar el subtotal pre-calculado del item si existe
                  let itemTotal = parseMontoLocal(item.total) || parseMontoLocal(item.subtotal) || 0;

                // 2. Si no hay subtotal, sumar componentes manualmente
                if (itemTotal === 0) {
                   let totalProf = 0;
                   const listaProfesionales = item.profesionalesLista || item.profesionales || [];
                   listaProfesionales.forEach(p => totalProf += (parseMontoLocal(p.subtotal) || parseMontoLocal(p.importe) || 0));
                   // Fallback a subtotalManoObra si la lista está vacía
                   if (totalProf === 0) totalProf = parseMontoLocal(item.subtotalManoObra);

                   let totalMat = 0;
                   const listaMateriales = item.materialesLista || item.materiales || [];
                   listaMateriales.forEach(m => totalMat += (parseMontoLocal(m.subtotal) || parseMontoLocal(m.importe) || 0));
                   // Fallback a subtotalMateriales
                   if (totalMat === 0) totalMat = parseMontoLocal(item.subtotalMateriales);

                   let totalOtros = 0;
                   const listaGastos = item.gastosGenerales || [];
                   listaGastos.forEach(g => totalOtros += (parseMontoLocal(g.subtotal) || parseMontoLocal(g.importe) || 0));

                   let totalSubItems = 0;
                   const listaSubItems = item.itemsLista || item.items || [];
                   listaSubItems.forEach(i => totalSubItems += (parseMontoLocal(i.subtotal) || parseMontoLocal(i.importe) || 0));

                   itemTotal = totalProf + totalMat + totalOtros + totalSubItems;
                }

                console.log(`   📦 Item ${idx + 1}: Total = $${itemTotal}`);
                return sum + itemTotal;
              }, 0);

              console.log(`📊 COSTO DIRECTO (suma items): $${subtotalCostoDirecto}`);

              // Aplicar Porcentajes Globales del Trabajo
              const gastosGeneralesMonto = subtotalCostoDirecto * ((parseMontoLocal(trabajo.gastosGeneralesPorcentaje) || 0) / 100);
              const subtotalConGastos = subtotalCostoDirecto + gastosGeneralesMonto;

              const utilidadMonto = subtotalConGastos * ((parseMontoLocal(trabajo.utilidadPorcentaje) || 0) / 100);
              const subtotalConUtilidad = subtotalConGastos + utilidadMonto;
              console.log(`📊 Utilidad (${trabajo.utilidadPorcentaje}%): $${utilidadMonto} → Subtotal: $${subtotalConUtilidad}`);

              const impuestosMonto = subtotalConUtilidad * ((parseMontoLocal(trabajo.impuestosPorcentaje) || 0) / 100);
              console.log(`📊 Impuestos (${trabajo.impuestosPorcentaje}%): $${impuestosMonto}`);

              totalDesdeItems = subtotalConUtilidad + impuestosMonto;
              console.log(`�🚀🚀 TOTAL BASE calculado: ${totalDesdeItems}`);
              console.log(`📊 TOTAL BASE (antes honorarios/mayores costos): $${totalDesdeItems}`);

              // --- Calcular Honorarios y Mayores Costos (basados en configuración de porcentajes) ---
              console.log(`🚀🚀🚀 Iniciando cálculo de Honorarios y Mayores Costos...`);
              let totalHonorarios = 0;
              let totalMayoresCostos = 0;

              // Calcular subtotales por categoría para aplicar porcentajes
              let subtotalJornales = 0;
              let subtotalMateriales = 0;
              let subtotalOtros = 0;

              console.log(`🚀🚀🚀 Analizando ${trabajo.itemsCalculadora.length} items para subtotales por categoría...`);

              trabajo.itemsCalculadora.forEach((item, itemIdx) => {
                // Jornales: intentar subtotalManoObra primero, si es 0 sumar array jornales
                let jorItem = parseMontoLocal(item.subtotalManoObra) || 0;
                if (jorItem === 0 && item.jornales && Array.isArray(item.jornales)) {
                  jorItem = item.jornales.reduce((sum, j) => sum + (parseMontoLocal(j.subtotal) || parseMontoLocal(j.importe) || 0), 0);
                }

                const matItem = parseMontoLocal(item.subtotalMateriales) || 0;
                const gastosItem = parseMontoLocal(item.subtotalGastosGenerales) || 0;

                subtotalJornales += jorItem;
                subtotalMateriales += matItem;
                subtotalOtros += gastosItem;

                console.log(`   ✅ Item ${itemIdx + 1}: Jornales=$${jorItem}, Materiales=$${matItem}, GG=$${gastosItem}`);
              });

              console.log(`📊 SUBTOTALES POR CATEGORÍA:`);
              console.log(`   👷 Jornales: $${subtotalJornales}`);
              console.log(`   🧱 Materiales: $${subtotalMateriales}`);
              console.log(`   📋 Otros Costos: $${subtotalOtros}`);

              // Aplicar configuración de Honorarios
              if (trabajo.honorarios && typeof trabajo.honorarios === 'object') {
                const confHon = trabajo.honorarios;
                console.log(`💼 Configuración Honorarios:`, confHon);

                if (confHon.jornalesActivo && confHon.jornalesValor) {
                  const honJornales = subtotalJornales * (parseFloat(confHon.jornalesValor) / 100);
                  totalHonorarios += honJornales;
                  console.log(`   👷 Honorarios Jornales (${confHon.jornalesValor}%): $${honJornales}`);
                }
                if (confHon.materialesActivo && confHon.materialesValor) {
                  const honMateriales = subtotalMateriales * (parseFloat(confHon.materialesValor) / 100);
                  totalHonorarios += honMateriales;
                  console.log(`   🧱 Honorarios Materiales (${confHon.materialesValor}%): $${honMateriales}`);
                }
                if (confHon.otrosCostosActivo && confHon.otrosCostosValor) {
                  const honOtros = subtotalOtros * (parseFloat(confHon.otrosCostosValor) / 100);
                  totalHonorarios += honOtros;
                  console.log(`   📋 Honorarios Otros (${confHon.otrosCostosValor}%): $${honOtros}`);
                }
                console.log(`💼 TOTAL HONORARIOS: $${totalHonorarios}`);
              } else {
                console.log(`⚠️ No hay configuración de honorarios`);
              }

              // Aplicar configuración de Mayores Costos
              if (trabajo.mayoresCostos && typeof trabajo.mayoresCostos === 'object') {
                const confMC = trabajo.mayoresCostos;
                console.log(`📈 Configuración Mayores Costos:`, confMC);

                // Mayores costos sobre las bases (sin honorarios)
                if (confMC.jornalesActivo && confMC.jornalesValor) {
                  const mcJornales = subtotalJornales * (parseFloat(confMC.jornalesValor) / 100);
                  totalMayoresCostos += mcJornales;
                  console.log(`   👷 MC Jornales (${confMC.jornalesValor}%): $${mcJornales}`);
                }
                if (confMC.materialesActivo && confMC.materialesValor) {
                  const mcMateriales = subtotalMateriales * (parseFloat(confMC.materialesValor) / 100);
                  totalMayoresCostos += mcMateriales;
                  console.log(`   🧱 MC Materiales (${confMC.materialesValor}%): $${mcMateriales}`);
                }
                if (confMC.otrosCostosActivo && confMC.otrosCostosValor) {
                  const mcOtros = subtotalOtros * (parseFloat(confMC.otrosCostosValor) / 100);
                  totalMayoresCostos += mcOtros;
                  console.log(`   📋 MC Otros (${confMC.otrosCostosValor}%): $${mcOtros}`);
                }

                // 🔥 MAYORES COSTOS SOBRE HONORARIOS (20% sobre el total de honorarios)
                if (confMC.honorariosActivo && confMC.honorariosValor && totalHonorarios > 0) {
                  const mcHonorarios = totalHonorarios * (parseFloat(confMC.honorariosValor) / 100);
                  totalMayoresCostos += mcHonorarios;
                  console.log(`   💼 MC sobre Honorarios (${confMC.honorariosValor}%): $${mcHonorarios}`);
                }

                console.log(`📈 TOTAL MAYORES COSTOS: $${totalMayoresCostos}`);
              } else {
                console.log(`⚠️ No hay configuración de mayores costos`);
              }

              totalDesdeItems += totalHonorarios + totalMayoresCostos;

              console.log(`💰💰💰 TRABAJO "${trabajo.nombre}" (ID:${trabajo.id}) - TOTAL FINAL: $${totalDesdeItems}`);
              console.log(`   Desglose: Costo Directo=$${subtotalCostoDirecto} + Gastos=$${gastosGeneralesMonto} + Util=$${utilidadMonto} + Imp=$${impuestosMonto} + Hon=$${totalHonorarios} + MC=$${totalMayoresCostos}`);

              } catch (calcError) {
                console.error(`🚀🚀🚀 ❌ ERROR EN CÁLCULO DE TRABAJO "${trabajo.nombre}":`, calcError);
                console.error(`🚀🚀🚀 Stack trace:`, calcError.stack);
              }
            }

            // --- 2. Calcular Total Simple (Fallback original) ---
            const totalProfesionales = (trabajo.profesionales || []).reduce((sum, prof) => {
              const importe = parseFloat(prof.importe) || 0;
              const dias = trabajo.dias?.length || 0;
              return sum + (importe * dias);
            }, 0);

            const totalTareas = (trabajo.tareas || []).reduce((sum, tarea) => {
              return sum + (parseFloat(tarea.importe) || 0);
            }, 0);

            const totalSimple = totalProfesionales + totalTareas;

            // 🔥 SELECCIÓN DEL TOTAL FINAL
            // Prioridad: Si hay itemsCalculadora, usar totalDesdeItems (incluso si es 0). Si no, usar BD o cálculo simple.
            let totalTrabajo;
            if (trabajo.itemsCalculadora && Array.isArray(trabajo.itemsCalculadora) && trabajo.itemsCalculadora.length > 0) {
              // Hay calculadora: usar SIEMPRE el resultado del cálculo completo
              totalTrabajo = totalDesdeItems;
              console.log(`💰 Trabajo "${trabajo.nombre}": Usando cálculo desde itemsCalculadora = $${totalTrabajo}`);
            } else {
              // No hay calculadora: usar valores de BD o cálculo simple
              totalTrabajo = parseFloat(trabajo.totalFinal) || parseFloat(trabajo.montoTotal) || totalSimple || 0;
              console.log(`💰 Trabajo "${trabajo.nombre}": Usando valores BD/Simple = $${totalTrabajo}`);
            }

            // Obtener resumen de pagos del backend
            let totalPagado = 0;
            let estadoPago = 'PENDIENTE';
            try {
              const resumen = await apiService.pagosTrabajoExtra.getResumen(trabajo.id);
              totalPagado = parseFloat(resumen.montoPagado) || 0;
              estadoPago = resumen.estadoPagoGeneral || 'PENDIENTE';
            } catch (error) {
              console.warn(`⚠️ No se pudo obtener resumen de pagos del trabajo ${trabajo.id}:`, error);
            }

            return {
              ...trabajo,
              presupuestoId: presupuesto.id,
              obraId: obraId,
              nombreObra: presupuesto.nombreObra,
              direccionObra: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim(),
              totalCalculado: totalTrabajo,
              totalProfesionales: totalProfesionales,
              totalTareas: totalTareas,
              totalPagado: totalPagado,
              estadoPago: estadoPago,
              saldo: totalTrabajo - totalPagado
            };
          }));

          return trabajosConPagos;
        } catch (error) {
          console.warn(`⚠️ No se pudieron cargar trabajos extra de obra ${presupuesto.obraId}:`, error);
          return [];
        }
      });

      const trabajosPorObra = await Promise.all(trabajosPromises);
      const todosTrabajos = trabajosPorObra.flat();

      return todosTrabajos;

    } catch (error) {
      console.error('❌ Error cargando trabajos extra:', error);
      return [];
    }
  };

  // Función para cargar trabajos adicionales de las obras
  const cargarTrabajosAdicionales = async (presupuestos) => {

    try {
      // Cargar todos los trabajos adicionales de la empresa
      const response = await apiService.trabajosAdicionales.getAll(empresaSeleccionada.id);
      let todosLosTrabajosAdicionales = Array.isArray(response) ? response : response?.data || [];

      // Obtener los IDs de obras desde obrasOriginales
      const obrasIds = obrasOriginales
        .filter(obra => !obra.esObraIndependiente)
        .map(obra => obra.obraId || obra.obra_id || obra.id)
        .filter(Boolean);

      // Filtrar trabajos adicionales que pertenecen a obras principales seleccionadas o trabajos extra
      const trabajosFiltrados = todosLosTrabajosAdicionales.filter(trabajo => {
        return (trabajo.obraId && obrasIds.includes(trabajo.obraId)) || trabajo.trabajoExtraId;
      });

      // Agregar obras independientes como trabajos adicionales
      const obrasIndependientes = obrasOriginales.filter(obra => {
        if (obra.hasOwnProperty('esObraIndependiente')) {
          return obra.esObraIndependiente;
        }
        // Fallback: detectar por ausencia de presupuesto
        const tienePresupuestoEnLista = presupuestos.some(p => (p.obraId || p.obra_id) === obra.id);
        return !tienePresupuestoEnLista;
      });

      // Convertir obras independientes en "trabajos adicionales especiales"
      const obrasIndependientesComoTrabajos = obrasIndependientes.map(obra => {
        const montoEstimado = obra.totalPresupuesto || obra.presupuestoEstimado || 0;

        return {
          id: `obra-independiente-${obra.id}`, // ID único
          nombre: obra.nombreObra || obra.direccion || `Obra ${obra.id}`,
          descripcion: `Obra Independiente: ${obra.nombreObra || obra.direccion || `Obra ${obra.id}`}`,
          obraId: obra.id,
          trabajoExtraId: null,
          montoEstimado: montoEstimado,
          importe: montoEstimado,
          monto: montoEstimado,
          montoPagado: 0, // Por defecto sin pagos
          esObraIndependiente: true, // ✅ Flag especial
          // Información de la obra
          nombreObra: obra.nombreObra || obra.direccion || `Obra ${obra.id}`,
          direccionObra: obra.direccion || '',
          estado: obra.estado || 'APROBADO',
          fechaCreacion: obra.fechaCreacion || new Date().toISOString()
        };
      });

      console.log(`✅ Generados ${obrasIndependientesComoTrabajos.length} trabajos adicionales desde obras independientes`);

      // Combinar trabajos adicionales reales + obras independientes
      const todosTrabajosCombinadosants = [...trabajosFiltrados, ...obrasIndependientesComoTrabajos];

      // Enriquecer cada trabajo con información de la obra
      // Enriquecer cada trabajo con información de la obra
      const trabajosEnriquecidos = todosTrabajosCombinadosants.map(trabajo => {
        // Buscar el presupuesto correspondiente
        let presupuesto = null;
        if (trabajo.obraId) {
          presupuesto = presupuestos.find(p =>
            (p.obraId || p.obra_id) === trabajo.obraId
          );
        }

        // ✅ Manejo especial para obras independientes
        if (trabajo.esObraIndependiente) {
          const montoEstimado = parseFloat(trabajo.montoEstimado || trabajo.importe || trabajo.monto || trabajo.importeEstimado) || 0;

          return {
            ...trabajo,
            presupuestoId: null, // No tiene presupuesto
            totalCalculado: montoEstimado,
            totalPagado: 0, // Por defecto sin pagos
            saldo: montoEstimado,
            estadoPago: 'PENDIENTE',
            // Mantener información de obra independiente
            nombreObra: trabajo.nombreObra,
            direccionObra: trabajo.direccionObra
          };
        }

        // Lógica existente para trabajos adicionales normales
        const montoEstimado = parseFloat(trabajo.montoEstimado || trabajo.importe || trabajo.monto || trabajo.importeEstimado) || 0;
        const montoPagado = parseFloat(trabajo.montoPagado || trabajo.importePagado) || 0;
        const saldo = montoEstimado - montoPagado;

        return {
          ...trabajo,
          esObraIndependiente: false, // ✅ Explícitamente false para trabajos adicionales normales
          presupuestoId: presupuesto?.id || null,
          obraId: trabajo.obraId || null,
          trabajoExtraId: trabajo.trabajoExtraId || null,
          nombreObra: presupuesto?.nombreObra || trabajo.nombreObra || 'Obra desconocida',
          direccionObra: presupuesto ?
            `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim() :
            '',
          totalCalculado: montoEstimado,
          totalPagado: montoPagado,
          saldo: saldo,
          estadoPago: saldo === 0 ? 'PAGADO_TOTAL' : (montoPagado > 0 ? 'PAGADO_PARCIAL' : 'PENDIENTE')
        };
      });

      return trabajosEnriquecidos;

    } catch (error) {
      console.error('❌ Error cargando trabajos adicionales:', error);
      return [];
    }
  };

  // 🔧 Función para calcular total de un trabajo extra
  const calcularTotalTrabajo = (trabajo) => {
    if (!trabajo) return 0;
    return trabajo.totalCalculado || 0;
  };

  // 🔧 Toggle selección de trabajo extra
  const toggleTrabajoExtra = (trabajoId) => {
    setTrabajosExtraSeleccionados(prev =>
      prev.includes(trabajoId)
        ? prev.filter(id => id !== trabajoId)
        : [...prev, trabajoId]
    );
  };

  // 🔧 Toggle todos los trabajos de una obra
  const toggleTodosTrabajoObra = (trabajosObra) => {
    const todosSeleccionados = trabajosObra.every(t =>
      trabajosExtraSeleccionados.includes(t.id)
    );

    if (todosSeleccionados) {
      setTrabajosExtraSeleccionados(prev =>
        prev.filter(id => !trabajosObra.some(t => t.id === id))
      );
    } else {
      const nuevosIds = trabajosObra
        .filter(t => t.saldo > 0)
        .map(t => t.id);
      setTrabajosExtraSeleccionados(prev => [...new Set([...prev, ...nuevosIds])]);
    }
  };

  // 🔧 Toggle detalles de trabajo
  const toggleDetallesTrabajo = (trabajoId) => {
    setMostrarDetallesTrabajo(prev => ({
      ...prev,
      [trabajoId]: !prev[trabajoId]
    }));
  };

  // Filtrar profesionales por la semana seleccionada
  const profesionalesFiltradosPorSemana = useMemo(() => {
    if (todosLosProfesionales.length === 0) return [];

    // Si semana es 0, mostrar TODOS los profesionales (sin filtrar)
    if (semanaSeleccionada === 0) {
      return todosLosProfesionales;
    }

    // Filtrar profesionales que trabajaron en la semana seleccionada
    return todosLosProfesionales.filter(prof => {
      // Verificar si el profesional trabajó en esta semana
      return prof.semanasTrabajadas && prof.semanasTrabajadas.includes(semanaSeleccionada);
    }).map(prof => {
      // Encontrar la información de esta semana específica
      const infoSemana = prof.semanas.find(s => s.numeroSemana === semanaSeleccionada);

      if (infoSemana) {
        // 🔥 Calcular valores solo para esta semana
        const diasSemana = infoSemana.diasTrabajados;
        const diasHabilesSemana = infoSemana.diasHabiles || diasSemana; // Solo días hábiles de esta semana
        const diasFeriadosSemana = infoSemana.diasFeriados || 0; // Solo feriados de esta semana
        const importeSemana = diasSemana * prof.importePorJornal;

        console.log(`📅 Semana ${semanaSeleccionada} - ${prof.nombreProfesional}: ${diasSemana} días (${diasHabilesSemana} hábiles, ${diasFeriadosSemana} feriados)`);

        return {
          ...prof,
          // 🔥 Reemplazar valores totales con valores de la semana
          totalJornales: diasSemana, // Total de días de esta semana
          totalJornalesHabiles: diasHabilesSemana, // Días hábiles de esta semana
          totalDiasFeriados: diasFeriadosSemana, // Feriados de esta semana
          diasTrabajados: diasSemana,
          cantidadJornales: diasSemana,
          precioTotal: importeSemana,
          importeCalculado: importeSemana,
          saldo: importeSemana - (prof.totalPagado || 0),
          fechaInicio: infoSemana.fechaInicio,
          fechaFin: infoSemana.fechaFin
        };
      }

      return prof;
    });
  }, [todosLosProfesionales, semanaSeleccionada]);

  // 🔥 NUEVO: Filtrar materiales por la semana seleccionada
  const materialesFiltradosPorSemana = useMemo(() => {
    if (todosMateriales.length === 0) return [];

    console.log(`🔍 Filtrando ${todosMateriales.length} materiales para semana ${semanaSeleccionada}...`);

    // Si semana es 0, mostrar SOLO materiales del presupuesto base (NO los asignados semanalmente)
    if (semanaSeleccionada === 0) {
      const materialesPresupuesto = todosMateriales.filter(mat => {
        const esAsignadoSemanal = mat.uniqueId && mat.uniqueId.includes('matAsignado');
        return !esAsignadoSemanal; // Solo materiales del presupuesto base
      });
      console.log(`✅ Semana 0 (Pagar Total): Mostrando ${materialesPresupuesto.length} materiales del presupuesto base (excluye ${todosMateriales.length - materialesPresupuesto.length} asignados semanalmente)`);
      return materialesPresupuesto;
    }

    // Filtrar materiales para una semana específica (1-6)
    const materialesFiltrados = todosMateriales.filter(mat => {
      // Materiales asignados semanalmente (tienen 'matAsignado' en uniqueId)
      const esAsignadoSemanal = mat.uniqueId && mat.uniqueId.includes('matAsignado');

      if (esAsignadoSemanal) {
        // Si es asignado semanalmente
        if (mat.semanaAsignacion !== null && mat.semanaAsignacion !== undefined) {
          // ✅ Tiene semanaAsignacion (del backend o calculada): filtrar por coincidencia exacta
          const coincide = mat.semanaAsignacion === semanaSeleccionada;
          if (!coincide) {
            console.log(`  ❌ Material "${mat.tipoMaterial}": semana=${mat.semanaAsignacion}, no coincide con ${semanaSeleccionada}`);
          }
          return coincide;
        } else {
          // ⚠️ NO tiene semanaAsignacion ni fechaAsignacion para calcular
          console.warn(`  ⚠️ Material asignado "${mat.tipoMaterial}": Sin info de semana - SE MUESTRA en todas`);
          return true;
        }
      } else {
        // Materiales del presupuesto base (no asignados semanalmente)
        // SOLO mostrarlos cuando semana = 0, NO en semanas específicas
        console.log(`  ❌ Material presupuesto "${mat.tipoMaterial}": NO se muestra en semanas específicas`);
        return false;
      }
    });

    console.log(`✅ Materiales filtrados: ${materialesFiltrados.length} de ${todosMateriales.length} para semana ${semanaSeleccionada}`);

    if (materialesFiltrados.length === 0) {
      console.warn(`⚠️ No hay materiales para semana ${semanaSeleccionada}.`);
      console.warn(`   Verifica que existan materiales asignados en esta semana.`);
    }

    return materialesFiltrados;
  }, [todosMateriales, semanaSeleccionada]);

  // 🔥 NUEVO: Filtrar otros costos por la semana seleccionada
  const otrosCostosFiltradosPorSemana = useMemo(() => {
    if (todosOtrosCostos.length === 0) return [];

    console.log(`🔍 Filtrando ${todosOtrosCostos.length} otros costos para semana ${semanaSeleccionada}...`);

    // 🔥 Si semana es 0 ("Todas las Semanas"), mostrar TODOS (presupuesto + asignados)
    if (semanaSeleccionada === 0) {
      console.log(`✅ Semana 0: Mostrando todos los ${todosOtrosCostos.length} otros costos (presupuesto + asignados)`);
      return todosOtrosCostos;
    }

    // 🔥 Si es una semana específica, mostrar SOLO los asignados de esa semana
    const costosFiltrados = todosOtrosCostos.filter(costo => {
      // Costos del presupuesto NO se muestran en semanas específicas
      if (costo.esDelPresupuesto) {
        return false;
      }

      // Costos asignados: filtrar por semana
      if (costo.semanaAsignacion !== null && costo.semanaAsignacion !== undefined) {
        return costo.semanaAsignacion === semanaSeleccionada;
      }

      // Si no tiene semanaAsignacion, no mostrar
      return false;
    });

    console.log(`✅ Otros costos filtrados: ${costosFiltrados.length} de ${todosOtrosCostos.length} para semana ${semanaSeleccionada}`);

    return costosFiltrados;
  }, [todosOtrosCostos, semanaSeleccionada]);

  // 🔥 NUEVO: Filtrar/Calcular trabajos adicionales por la semana seleccionada (Lógica de Cuotas)
  const trabajosExtraFiltradosPorSemana = useMemo(() => {
    if (todosLosTrabajos.length === 0) return [];

    console.log(`🔍 Calculando ${todosLosTrabajos.length} trabajos adicionales para semana ${semanaSeleccionada}...`);

    return todosLosTrabajos
      .filter(trabajo => {
        // Si es "Todas las Semanas", mostrar todos
        if (semanaSeleccionada === 0) return true;

        // Si es una semana específica, verificar si el trabajo está activo en esa semana
        const diasDuracion = parseInt(trabajo.tiempoEstimadoTerminacion) || 5;
        const semanasDuracion = Math.max(1, Math.ceil(diasDuracion / 5));

        // Solo mostrar si la semana seleccionada está dentro de la duración del trabajo
        const debeMotrar = semanaSeleccionada <= semanasDuracion;

        if (!debeMotrar) {
          console.log(`🚫 Trabajo "${trabajo.nombre}": Duración ${semanasDuracion} semanas - NO se muestra en semana ${semanaSeleccionada}`);
        }

        return debeMotrar;
      })
      .map(trabajo => {
        // Copia del trabajo para no mutar el original
        const trabajoDisplay = { ...trabajo };

        if (semanaSeleccionada === 0) {
            // Modo "Todas las Semanas": Mostrar totales reales sin modificar
            return trabajoDisplay;
        }

        // Modo "Semana X": Calcular cuota proporcional
        // Asumimos 5 días hábiles por semana si no se especifica otra cosa.
        // Convertimos tiempoEstimadoTerminacion (que viene en días) a semanas.
        const diasDuracion = parseInt(trabajo.tiempoEstimadoTerminacion) || 5;
        const semanasDuracion = Math.max(1, Math.ceil(diasDuracion / 5));

        const importeTotalOriginal = trabajo.totalCalculado || 0;
        const importeCuota = importeTotalOriginal / semanasDuracion;

        // Calcular saldo real restante global (Total - PagadoGlobal)
        const saldoRealGeneral = importeTotalOriginal - (trabajo.totalPagado || 0);

        // Lógica de Visualización para la Cuota:
        // 1. "Total": Muestra el valor de la cuota semanal teórica (Importe / Semanas).
        trabajoDisplay.totalCalculado = importeCuota;

        // 2. "Saldo" (A Pagar): Es el valor de la cuota, pero no puede exceder lo que realmente falta pagar del trabajo.
        //    Si falta pagar $200 y la cuota es $500, solo cobramos $200.
        trabajoDisplay.saldo = Math.max(0, Math.min(importeCuota, saldoRealGeneral));

        // 3. "Pagado": Ajuste visual para consistencia (Total - Saldo = Pagado).
        //    Indica cuánto de esta "cuota teórica" ya estaría cubierto por pagos anteriores globales.
        trabajoDisplay.totalPagado = Math.max(0, importeCuota - trabajoDisplay.saldo);

        console.log(`🔧 Trabajo "${trabajo.nombre}": Duración ${diasDuracion} días (${semanasDuracion} semanas). Total Original: ${importeTotalOriginal}, Cuota Mostrada: ${importeCuota}`);

        return trabajoDisplay;
    });
  }, [todosLosTrabajos, semanaSeleccionada]);

  const handleToggleProfesional = (prof) => {
    const uniqueId = prof.uniqueId || `${prof.presupuestoId}-${prof.profesionalId || prof.id}`;

    if (profesionalesSeleccionados.some(p => (p.uniqueId || `${p.presupuestoId}-${p.profesionalId || p.id}`) === uniqueId)) {
      setProfesionalesSeleccionados(profesionalesSeleccionados.filter(
        p => (p.uniqueId || `${p.presupuestoId}-${p.profesionalId || p.id}`) !== uniqueId
      ));
    } else {
      setProfesionalesSeleccionados([...profesionalesSeleccionados, prof]);
    }
  };

  const handleSeleccionarTodos = () => {
    if (profesionalesSeleccionados.length === profesionalesFiltradosPorSemana.length) {
      setProfesionalesSeleccionados([]);
    } else {
      setProfesionalesSeleccionados([...profesionalesFiltradosPorSemana]);
    }
  };

  // 🔥 NUEVO: Handler para toggle de materiales
  const handleToggleMaterial = (mat) => {
    const uniqueId = mat.uniqueId;

    if (materialesSeleccionados.some(m => m.uniqueId === uniqueId)) {
      setMaterialesSeleccionados(materialesSeleccionados.filter(m => m.uniqueId !== uniqueId));
    } else {
      setMaterialesSeleccionados([...materialesSeleccionados, mat]);
    }
  };

  // 🔥 NUEVO: Handler para seleccionar todos los materiales
  const handleSeleccionarTodosMateriales = () => {
    if (materialesSeleccionados.length === materialesFiltradosPorSemana.length) {
      setMaterialesSeleccionados([]);
    } else {
      setMaterialesSeleccionados([...materialesFiltradosPorSemana]);
    }
  };

  // 🔥 NUEVO: Handler para toggle de otros costos
  const handleToggleOtroCosto = (costo) => {
    const uniqueId = costo.uniqueId;

    if (otrosCostosSeleccionados.some(c => c.uniqueId === uniqueId)) {
      setOtrosCostosSeleccionados(otrosCostosSeleccionados.filter(c => c.uniqueId !== uniqueId));
    } else {
      setOtrosCostosSeleccionados([...otrosCostosSeleccionados, costo]);
    }
  };

  // 🔥 NUEVO: Handler para seleccionar todos los otros costos
  const handleSeleccionarTodosOtrosCostos = () => {
    if (otrosCostosSeleccionados.length === otrosCostosFiltradosPorSemana.length) {
      setOtrosCostosSeleccionados([]);
    } else {
      setOtrosCostosSeleccionados([...otrosCostosFiltradosPorSemana]);
    }
  };

  const calcularTotalSeleccionados = () => {
    let total = 0;

    // Sumar profesionales
    total += profesionalesSeleccionados.reduce((sum, prof) => {
      const saldoPendiente = (prof.importeCalculado || 0) - (prof.totalPagado || 0);
      const adelantosPend = prof.adelantosPendientes || 0;
      return sum + Math.max(0, saldoPendiente - adelantosPend);
    }, 0);

    // Sumar materiales
    total += materialesSeleccionados.reduce((sum, mat) => {
      const saldoPendiente = (mat.importeCalculado || 0) - (mat.totalPagado || 0);
      return sum + Math.max(0, saldoPendiente);
    }, 0);

    // Sumar otros costos
    total += otrosCostosSeleccionados.reduce((sum, costo) => {
      const saldoPendiente = (costo.importeCalculado || 0) - (costo.totalPagado || 0);
      return sum + Math.max(0, saldoPendiente);
    }, 0);

    // 🆕 Sumar trabajos extra
    total += trabajosExtraSeleccionados.reduce((sum, trabajoId) => {
      // 🔥 Usar la lista filtrada/calculada (para que tome el valor de la cuota si aplica)
      const trabajo = trabajosExtraFiltradosPorSemana.find(t => t.id === trabajoId);
      if (trabajo) {
        // Usar .saldo directamente, ya que en trabajosExtraFiltradosPorSemana el saldo ya representa lo que se va a pagar (cuota o total)
        return sum + Math.max(0, trabajo.saldo || 0);
      }
      return sum;
    }, 0);

    return total;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const totalSeleccionados = profesionalesSeleccionados.length + materialesSeleccionados.length + otrosCostosSeleccionados.length + trabajosExtraSeleccionados.length;

    if (totalSeleccionados === 0) {
      setError('Debe seleccionar al menos un item para pagar (profesional, material, otro costo o trabajo extra)');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`💰 Registrando pagos consolidados:`);
      console.log(`  - ${profesionalesSeleccionados.length} profesionales`);
      console.log(`  - ${materialesSeleccionados.length} materiales`);
      console.log(`  - ${otrosCostosSeleccionados.length} otros costos`);

      let exitosos = 0;
      let fallidos = 0;
      const resultadosMensajes = [];

      // 👷 REGISTRAR PAGOS DE PROFESIONALES
      if (profesionalesSeleccionados.length > 0) {
        console.log('👷 PROFESIONALES SELECCIONADOS A PAGAR:',
          profesionalesSeleccionados.map(p => ({
            nombre: p.nombreProfesional,
            profesionalObraId: p.profesionalObraId,
            id: p.id,
            asignacionId: p.asignacionId,
            importeCalculado: p.importeCalculado,
            totalPagado: p.totalPagado,
            saldoPendiente: Math.max(0, (p.importeCalculado || 0) - (p.totalPagado || 0))
          }))
        );

        const resultadosProf = await Promise.all(
          profesionalesSeleccionados.map(async (prof) => {
            let pago = null; // Declarar fuera del try para acceso en catch
            try {
              const saldoPendiente = Math.max(0, (prof.importeCalculado || 0) - (prof.totalPagado || 0));

              if (saldoPendiente === 0) {
                console.warn(`⚠️ ${prof.nombreProfesional} ya está completamente pagado, omitiendo...`);
                return { success: true, nombre: prof.nombreProfesional, omitido: true };
              }

              pago = {
                profesionalObraId: prof.asignacionId || prof.profesionalObraId || prof.id,
                tipoPago: tipoPago,
                montoPagado: saldoPendiente,
                fechaPago: fechaPago,
                observaciones: `Pago consolidado - ${prof.nombreObra}${prof.totalPagado > 0 ? ' (Saldo pendiente)' : ''}`,
                estado: 'PAGADO',
                empresaId: empresaSeleccionada.id
              };

              console.log(`💰 Pagando profesional ${prof.nombreProfesional}:`, {
                profesional: prof.nombreProfesional,
                monto: saldoPendiente,
                pagoData: pago,
                empresaId: empresaSeleccionada.id
              });

              const result = await registrarPago(pago, empresaSeleccionada.id);
              return { success: true, nombre: prof.nombreProfesional, tipo: 'profesional', result };
            } catch (error) {
              console.error(`❌ ERROR DETALLADO pagando a ${prof.nombreProfesional}:`, {
                profesional: prof.nombreProfesional,
                errorMessage: error.message,
                errorStatus: error.response?.status,
                errorData: error.response?.data,
                pagoIntentado: pago,
                profesionalData: prof
              });
              return { success: false, nombre: prof.nombreProfesional, tipo: 'profesional', error };
            }
          })
        );

        exitosos += resultadosProf.filter(r => r.success && !r.omitido).length;
        fallidos += resultadosProf.filter(r => !r.success).length;
        resultadosMensajes.push(`${resultadosProf.filter(r => r.success && !r.omitido).length} profesionales`);
      }

      // 🧱 REGISTRAR PAGOS DE MATERIALES
      if (materialesSeleccionados.length > 0) {
        console.log('🧱 Materiales a pagar:', materialesSeleccionados);

        const resultadosMat = await Promise.all(
          materialesSeleccionados.map(async (mat) => {
            try {
              const saldoPendiente = Math.max(0, (mat.importeCalculado || 0) - (mat.totalPagado || 0));

              if (saldoPendiente === 0) {
                console.warn(`⚠️ Material ${mat.tipoMaterial} ya está pagado, omitiendo...`);
                return { success: true, nombre: mat.tipoMaterial, omitido: true };
              }

              const pagoMaterial = {
                empresaId: empresaSeleccionada.id, // 🔥 Explícito
                presupuestoNoClienteId: mat.presupuestoId,
                itemCalculadoraId: mat.itemId, // 🆕 REQUERIDO por backend
                materialCalculadoraId: mat.materialId,
                tipoPago: 'MATERIALES',
                concepto: `Pago material: ${mat.tipoMaterial}`,
                cantidad: mat.cantidad,
                precioUnitario: mat.precioUnitario,
                monto: saldoPendiente,
                metodoPago: 'TRANSFERENCIA',
                fechaPago: fechaPago,
                estado: 'PAGADO',
                observaciones: `Pago consolidado - ${mat.nombreObra}`
              };

              console.log(`💰 Pagando material ${mat.tipoMaterial}`);
              console.log('🔍 ESTRUCTURA COMPLETA del material:', mat);
              console.log('📤 Payload a enviar:', JSON.stringify(pagoMaterial, null, 2));

              // 🔧 Usar servicio en lugar de fetch directo
              const result = await registrarPagoConsolidado(pagoMaterial, empresaSeleccionada.id);
              return { success: true, nombre: mat.tipoMaterial, tipo: 'material', result };
            } catch (error) {
              console.error(`❌ Error pagando material ${mat.tipoMaterial}:`, error);
              return { success: false, nombre: mat.tipoMaterial, tipo: 'material', error };
            }
          })
        );

        exitosos += resultadosMat.filter(r => r.success && !r.omitido).length;
        fallidos += resultadosMat.filter(r => !r.success).length;
        resultadosMensajes.push(`${resultadosMat.filter(r => r.success && !r.omitido).length} materiales`);
      }

      // 📋 REGISTRAR PAGOS DE OTROS COSTOS
      if (otrosCostosSeleccionados.length > 0) {
        console.log('📋 Otros costos a pagar:', otrosCostosSeleccionados);

        const resultadosCostos = await Promise.all(
          otrosCostosSeleccionados.map(async (costo) => {
            try {
              const saldoPendiente = Math.max(0, (costo.importeCalculado || 0) - (costo.totalPagado || 0));

              if (saldoPendiente === 0) {
                console.warn(`⚠️ Costo ${costo.descripcion} ya está pagado, omitiendo...`);
                return { success: true, nombre: costo.descripcion, omitido: true };
              }

              const pagoCosto = {
                empresaId: empresaSeleccionada.id, // 🔥 Explícito
                presupuestoNoClienteId: costo.presupuestoId,
                itemCalculadoraId: costo.itemId, // 🆕 REQUERIDO por backend
                gastoGeneralCalculadoraId: costo.gastoGeneralCalculadoraId, // 🔥 ID del gasto en la calculadora
                tipoPago: 'GASTOS_GENERALES',
                concepto: `Pago gasto: ${costo.descripcion}`,
                cantidad: 1,
                precioUnitario: saldoPendiente,
                monto: saldoPendiente,
                metodoPago: 'TRANSFERENCIA',
                fechaPago: fechaPago,
                estado: 'PAGADO',
                observaciones: `Pago consolidado - ${costo.nombreObra}`
              };

              console.log(`💰 Pagando costo ${costo.descripcion}:`, pagoCosto);
              console.log('📤 Payload enviado:', JSON.stringify(pagoCosto, null, 2));

              // 🔧 Usar servicio en lugar de fetch directo
              const result = await registrarPagoConsolidado(pagoCosto, empresaSeleccionada.id);
              return { success: true, nombre: costo.descripcion, tipo: 'gasto', result };
            } catch (error) {
              console.error(`❌ Error pagando costo ${costo.descripcion}:`, error);
              return { success: false, nombre: costo.descripcion, tipo: 'gasto', error };
            }
          })
        );

        exitosos += resultadosCostos.filter(r => r.success && !r.omitido).length;
        fallidos += resultadosCostos.filter(r => !r.success).length;
        resultadosMensajes.push(`${resultadosCostos.filter(r => r.success && !r.omitido).length} otros costos`);
      }

      // 🔧 REGISTRAR PAGOS DE TRABAJOS EXTRA
      if (trabajosExtraSeleccionados.length > 0) {
        console.log('🔧 Trabajos extra a pagar:', trabajosExtraSeleccionados);

        const resultadosTrabajos = await Promise.all(
          trabajosExtraSeleccionados.map(async (trabajoId) => {
            // 🔥 Usar la lista filtrada para obtener los montos calculados (cuota)
            const trabajo = trabajosExtraFiltradosPorSemana.find(t => t.id === trabajoId);
            let pagoTrabajoExtra = null;

            try {
              if (!trabajo) {
                console.warn(`⚠️ No se encontró el trabajo extra ${trabajoId}`);
                return { success: false, nombre: 'Desconocido', error: 'Trabajo no encontrado' };
              }

              // El saldo ya viene calculado según cuota en trabajosExtraFiltradosPorSemana
              const saldoPendiente = trabajo.saldo || 0;

              if (saldoPendiente === 0) {
                console.warn(`⚠️ Trabajo extra ${trabajo.nombre} ya está pagado (en esta cuota o total), omitiendo...`);
                return { success: true, nombre: trabajo.nombre, omitido: true };
              }

              pagoTrabajoExtra = {
                trabajoExtraId: trabajo.id,
                obraId: trabajo.obraId,
                empresaId: empresaSeleccionada.id,
                presupuestoNoClienteId: trabajo.presupuestoId,
                trabajoExtroProfesionalId: null,
                trabajoExtraTareaId: null,
                tipoPago: 'PAGO_GENERAL',
                concepto: `Pago trabajo extra${semanaSeleccionada > 0 ? ` (Semana ${semanaSeleccionada})` : ''}: ${trabajo.nombre}`,
                montoBase: saldoPendiente,
                descuentos: 0,
                bonificaciones: 0,
                montoFinal: saldoPendiente,
                fechaPago: fechaPago,
                fechaEmision: fechaPago,
                estado: 'PAGADO',
                metodoPago: 'TRANSFERENCIA',
                observaciones: `Pago consolidado${semanaSeleccionada > 0 ? ` Semana ${semanaSeleccionada}` : ''} - ${trabajo.nombreObra}`,
                usuarioCreacionId: 1 // TODO: Obtener del contexto de usuario
              };

              console.log(`💰 Pagando trabajo extra ${trabajo.nombre}:`, pagoTrabajoExtra);

              const result = await apiService.pagosTrabajoExtra.create(pagoTrabajoExtra);
              return { success: true, nombre: trabajo.nombre, tipo: 'trabajo_extra', result };
            } catch (error) {
              console.error(`❌ Error pagando trabajo extra ${trabajo?.nombre || trabajoId}:`, {
                trabajo,
                payload: pagoTrabajoExtra,
                error,
                errorData: error.data,
                errorMessage: error.message,
                errorResponse: error.response?.data,
                errorStatus: error.response?.status || error.status
              });
              return { success: false, nombre: trabajo?.nombre || 'Desconocido', tipo: 'trabajo_extra', error };
            }
          })
        );

        exitosos += resultadosTrabajos.filter(r => r.success && !r.omitido).length;
        fallidos += resultadosTrabajos.filter(r => !r.success).length;
        resultadosMensajes.push(`${resultadosTrabajos.filter(r => r.success && !r.omitido).length} trabajos extra`);
      }

      console.log(`✅ ${exitosos} pagos exitosos, ❌ ${fallidos} fallidos`);

      if (exitosos > 0) {
        // � Recargar datos desde la BD para reflejar los pagos
        console.log('🔄 Recargando datos desde la BD después del pago...');
        await cargarPresupuestosYProfesionales();
        console.log('✅ Datos recargados exitosamente');

        // �🔔 Emitir evento para sincronización automática
        eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
          cantidad: exitosos,
          fallidos: fallidos,
          tipoPago: tipoPago,
          fecha: fechaPago,
          empresaId: empresaSeleccionada.id,
          desglose: resultadosMensajes
        });

        onSuccess?.({
          mensaje: `Pagos registrados: ${resultadosMensajes.join(', ')}${fallidos > 0 ? ` (${fallidos} fallidos)` : ''}`
        });
        onHide();
      } else {
        setError('No se pudo registrar ningún pago');
      }

    } catch (error) {
      console.error('❌ Error registrando pagos:', error);
      setError('Error al registrar los pagos');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="bi bi-cash-stack me-2"></i>
              Pago Consolidado - Todas las Obras Activas
            </h5>
            <button
              type="button"
              className="btn btn-light btn-sm ms-auto"
              onClick={onHide}
            >
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3">Cargando datos...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* ...se eliminó el resumen de obras para simplificar la UI... */}

                {/* Selector de Semana (Opcional) */}
                <div className="card bg-light mb-3">
                  <div className="card-body">
                    <label className="form-label fw-bold">
                      <i className="bi bi-calendar-week me-2"></i>
                      Seleccionar Semana (Opcional)
                    </label>
                    <select
                      className="form-select"
                      value={semanaSeleccionada}
                      onChange={(e) => setSemanaSeleccionada(Number(e.target.value))}
                    >
                      <option value={0}>-- Todas las Semanas (Pagar Total) --</option>
                      {Array.from({ length: maxSemanas }, (_, i) => i + 1).map(semana => (
                        <option key={semana} value={semana}>
                          Semana {semana}
                        </option>
                      ))}
                    </select>
                    <small className="text-muted d-block mt-2">
                      <i className="bi bi-info-circle me-1"></i>
                      {semanaSeleccionada === 0
                        ? 'Se incluirán todas las semanas de cada obra'
                        : `Solo se mostrarán los datos de la Semana ${semanaSeleccionada}`}
                    </small>
                    <div className="alert alert-info mt-2 mb-0 py-2" style={{fontSize:'0.85rem'}}>
                      <i className="bi bi-calendar-check me-1"></i>
                      <strong>Calendario de Feriados:</strong> El sistema tiene en cuenta los feriados nacionales de Argentina (2025-2026).
                      Use los botones "<strong>📅 Asignados</strong>" o "<strong>✅ Hábiles</strong>" en la columna "Días Trabajados" para elegir si desea incluir o excluir los feriados en el cálculo de pagos.
                      Los días marcados como feriados se identifican con 🗓️ en la tabla.
                    </div>
                  </div>
                </div>

                {/* TABS tipo btn-group */}
                <div className="mb-3">
                  <div className="btn-group w-100" role="group">
                    <button type="button" className={`btn btn-lg ${tabActiva === 'PROFESIONALES' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTabActiva('PROFESIONALES')}>
                      👷 Profesionales ({profesionalesFiltradosPorSemana.length})
                    </button>
                    <button type="button" className={`btn btn-lg ${tabActiva === 'MATERIALES' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setTabActiva('MATERIALES')}>
                      🧱 Materiales ({materialesFiltradosPorSemana.length})
                    </button>
                    <button type="button" className={`btn btn-lg ${tabActiva === 'OTROS_COSTOS' ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setTabActiva('OTROS_COSTOS')}>
                      📋 Otros Costos ({otrosCostosFiltradosPorSemana.length})
                    </button>
                  </div>
                </div>

                {/* CONTENIDO DE TABS */}
                <div className="tab-content">
                  {/* TAB PROFESIONALES */}
                  {tabActiva === 'PROFESIONALES' && (
                    <>
                      {profesionalesFiltradosPorSemana.length === 0 ? (
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          No hay profesionales asignados {semanaSeleccionada > 0 ? `en la semana ${semanaSeleccionada}` : 'en las obras seleccionadas'}
                        </div>
                      ) : (
                        <>
                          {/* 🆕 Agrupar presupuestos con sus subobras */}
                          {(() => {
                            const presupuestosConSubobras = [];
                            const subobrasYaAgregadas = new Set();

                            // Ordenar por nombre para mantener consistencia
                            const presupuestosOrdenados = [...presupuestos].sort((a, b) =>
                              (a.nombreObra || '').localeCompare(b.nombreObra || '')
                            );

                            presupuestosOrdenados.forEach(presupuesto => {
                              if (subobrasYaAgregadas.has(presupuesto.id)) return;

                              // Buscar subobras: presupuestos cuyo nombre contiene el nombre de este presupuesto
                              const subobras = presupuestosOrdenados.filter(posibleSubobra => {
                                if (posibleSubobra.id === presupuesto.id) return false;

                                // Detectar si es subobra: el nombre incluye el nombre de la obra padre
                                const nombreObra = presupuesto.nombreObra || '';
                                const nombrePosibleSubobra = posibleSubobra.nombreObra || '';

                                // ✅ FIX: No considerar como subobra si los nombres son exactamente iguales
                                if (nombreObra === nombrePosibleSubobra) return false;

                                const esSubobra = nombrePosibleSubobra.startsWith(nombreObra + ' ') ||
                                                nombrePosibleSubobra.includes(nombreObra + ' ');
                                return esSubobra;
                              });

                              // Marcar subobras como ya procesadas
                              subobras.forEach(sub => subobrasYaAgregadas.add(sub.id));

                              presupuestosConSubobras.push({
                                ...presupuesto,
                                subobras
                              });
                            });

                            return presupuestosConSubobras;
                          })().map((presupuesto, presupuestoIdx, presupuestosArray) => {
                            const profesionalesObra = profesionalesFiltradosPorSemana.filter(
                              p => p.presupuestoId === presupuesto.id
                            );

                            if (profesionalesObra.length === 0 && (!presupuesto.subobras || presupuesto.subobras.length === 0)) return null;

                            const totalAPagarObra = profesionalesObra.reduce((sum, p) => sum + (p.importeCalculado || 0), 0);
                            const totalPagadoObra = profesionalesObra.reduce((sum, p) => sum + (p.totalPagado || 0), 0);
                            const saldoObra = totalAPagarObra - totalPagadoObra;

                            return (
                              <div key={presupuesto.id} className="mb-4">
                                {/* Encabezado de Obra */}
                                <div className="card border-primary">
                                  <div className="card-header bg-primary text-white">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <div>
                                        <h6 className="mb-0">
                                          <i className="bi bi-building me-2"></i>
                                          {presupuesto.nombreObra}
                                        </h6>
                                        <small>
                                          <i className="bi bi-geo-alt me-1"></i>
                                          {presupuesto.direccionObra}
                                        </small>
                                      </div>
                                      <div className="text-end">
                                        <div className="badge bg-light text-dark">
                                          {profesionalesObra.length} profesional(es)
                                        </div>
                                        <div className="mt-1">
                                          <small className="text-white-50">Saldo: </small>
                                          <strong>${saldoObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="card-body p-0">
                                    <div className="table-responsive">
                                      <table className="table table-hover table-bordered mb-0">
                                        <thead style={{backgroundColor:'#f8f9fa'}}>
                                          <tr>
                                            <th style={{minWidth:'120px',padding:'8px'}}>Tipo Profesional</th>
                                            <th style={{minWidth:'150px',padding:'8px'}}>Nombre Completo</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'center'}}>
                                              <div className="d-flex flex-column align-items-center gap-1">
                                                <span>Días Trabajados</span>
                                                <div className="btn-group btn-group-sm" role="group">
                                                  <button
                                                    type="button"
                                                    className={`btn ${!mostrarSoloHabiles ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setMostrarSoloHabiles(false)}
                                                    style={{fontSize:'0.7rem',padding:'2px 8px'}}
                                                    title="Mostrar todos los días asignados (incluye feriados)"
                                                  >
                                                    📅 Asignados
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={`btn ${mostrarSoloHabiles ? 'btn-success' : 'btn-outline-success'}`}
                                                    onClick={() => setMostrarSoloHabiles(true)}
                                                    style={{fontSize:'0.7rem',padding:'2px 8px'}}
                                                    title="Mostrar solo días hábiles (excluye feriados)"
                                                  >
                                                    ✅ Hábiles
                                                  </button>
                                                </div>
                                              </div>
                                            </th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Honorarios Diarios</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Total a Pagar</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Total Pagado</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Saldo Pendiente</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right',color:'#e65100'}}>💸 Adelantos</th>
                                            <th style={{minWidth:'130px',padding:'8px',textAlign:'right',backgroundColor:'#f1f8e9',fontWeight:'bold'}}>✅ Neto a Cobrar</th>
                                            <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Estado Pago</th>
                                            <th style={{minWidth:'80px',padding:'8px',textAlign:'center'}}>
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={profesionalesObra.every(p => profesionalesSeleccionados.some(
                                                  sel => (sel.uniqueId || `${sel.presupuestoId}-${sel.profesionalId}`) === (p.uniqueId || `${p.presupuestoId}-${p.profesionalId}`)
                                                ))}
                                                onChange={() => {
                                                  const todosSeleccionados = profesionalesObra.every(p => profesionalesSeleccionados.some(
                                                    sel => (sel.uniqueId || `${sel.presupuestoId}-${sel.profesionalId}`) === (p.uniqueId || `${p.presupuestoId}-${p.profesionalId}`)
                                                  ));
                                                  if (todosSeleccionados) {
                                                    // Deseleccionar todos de esta obra
                                                    setProfesionalesSeleccionados(profesionalesSeleccionados.filter(
                                                      sel => !profesionalesObra.some(p =>
                                                        (sel.uniqueId || `${sel.presupuestoId}-${sel.profesionalId}`) === (p.uniqueId || `${p.presupuestoId}-${p.profesionalId}`)
                                                      )
                                                    ));
                                                  } else {
                                                    // Seleccionar todos de esta obra
                                                    const nuevosSeleccionados = [...profesionalesSeleccionados];
                                                    profesionalesObra.forEach(p => {
                                                      if (!nuevosSeleccionados.some(sel =>
                                                        (sel.uniqueId || `${sel.presupuestoId}-${sel.profesionalId}`) === (p.uniqueId || `${p.presupuestoId}-${p.profesionalId}`)
                                                      )) {
                                                        nuevosSeleccionados.push(p);
                                                      }
                                                    });
                                                    setProfesionalesSeleccionados(nuevosSeleccionados);
                                                  }
                                                }}
                                                disabled={saldoObra === 0}
                                              />
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {profesionalesObra.map((prof, idx) => {
                                            const uniqueId = prof.uniqueId || `${prof.presupuestoId}-${prof.profesionalId || prof.id}`;
                                            const estaSeleccionado = profesionalesSeleccionados.some(
                                              p => (p.uniqueId || `${p.presupuestoId}-${p.profesionalId || p.id}`) === uniqueId
                                            );
                                            const saldoPendiente = (prof.importeCalculado || 0) - (prof.totalPagado || 0);
                                            const estaPagado = saldoPendiente <= 0 && (prof.importeCalculado || 0) > 0;

                                            // Información de feriados para tooltip
                                            const totalHabiles = prof.totalJornalesHabiles || prof.totalJornales || 0;
                                            const totalFeriados = prof.totalDiasFeriados || 0;
                                            const totalDias = prof.totalJornales || prof.diasTrabajados || prof.cantidadJornales || 0;
                                            const hayFeriados = totalFeriados > 0;

                                            // 🗓️ Determinar qué días mostrar según el toggle
                                            const diasAMostrar = mostrarSoloHabiles ? totalHabiles : totalDias;
                                            const totalAPagar = mostrarSoloHabiles
                                              ? totalHabiles * (prof.tarifaPorDia || prof.precioJornal || 0)
                                              : (prof.importeCalculado || prof.precioTotal || 0);
                                            const saldoAjustado = totalAPagar - (prof.totalPagado || 0);
                                            const adelantosPendientes = prof.adelantosPendientes || 0;
                                            const netoACobrar = Math.max(0, saldoAjustado - adelantosPendientes);

                                            return (
                                              <tr key={uniqueId} className={estaPagado ? 'table-success' : ''}>
                                                <td>{prof.tipoProfesional || prof.tipo || '-'}</td>
                                                <td>
                                                  {prof.nombreProfesional || prof.nombre || '-'}
                                                  {estaPagado && (
                                                    <span className="badge bg-success ms-2">✅ PAGADO</span>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  <div className="d-flex justify-content-center align-items-center gap-1">
                                                    <span className="fw-bold">{diasAMostrar}</span>
                                                    {hayFeriados && !mostrarSoloHabiles && (
                                                      <span
                                                        className="badge bg-warning text-dark"
                                                        style={{fontSize:'0.65rem',cursor:'help'}}
                                                        title={`🗓️ Total: ${totalDias} días\n✅ Hábiles: ${totalHabiles} días\n🎉 Feriados: ${totalFeriados} día(s)`}
                                                      >
                                                        🗓️ {totalFeriados}F
                                                      </span>
                                                    )}
                                                    {mostrarSoloHabiles && hayFeriados && (
                                                      <span
                                                        className="badge bg-info text-dark"
                                                        style={{fontSize:'0.65rem',cursor:'help'}}
                                                        title={`✅ Días hábiles: ${totalHabiles}\n🗓️ Total asignados: ${totalDias}\n🎉 Feriados excluidos: ${totalFeriados}`}
                                                      >
                                                        -{totalFeriados}🗓️
                                                      </span>
                                                    )}
                                                  </div>
                                                  {hayFeriados && (
                                                    <small className="text-muted d-block" style={{fontSize:'0.7rem'}}>
                                                      {mostrarSoloHabiles
                                                        ? `(${totalDias} total)`
                                                        : `(${totalHabiles} hábiles)`}
                                                    </small>
                                                  )}
                                                </td>
                                                <td className="text-end">${(prof.tarifaPorDia || prof.precioJornal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end fw-bold">
                                                  ${totalAPagar.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                  {mostrarSoloHabiles && hayFeriados && (
                                                    <small className="d-block text-muted" style={{fontSize:'0.7rem'}}>
                                                      (${(prof.importeCalculado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})} total)
                                                    </small>
                                                  )}
                                                </td>
                                                <td className="text-end text-success">${(prof.totalPagado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end text-danger">
                                                  ${saldoAjustado.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                  {mostrarSoloHabiles && hayFeriados && Math.abs(saldoAjustado - saldoPendiente) > 0.01 && (
                                                    <small className="d-block text-muted" style={{fontSize:'0.7rem'}}>
                                                      (${saldoPendiente.toLocaleString('es-AR', {minimumFractionDigits: 2})} total)
                                                    </small>
                                                  )}
                                                </td>
                                                <td className="text-end" style={{color: adelantosPendientes > 0 ? '#e65100' : '#aaa'}}>
                                                  {adelantosPendientes > 0
                                                    ? `-$\u00A0${adelantosPendientes.toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                                    : <span className="text-muted">—</span>
                                                  }
                                                </td>
                                                <td className="text-end fw-bold" style={{
                                                  backgroundColor: adelantosPendientes > 0 ? '#f1f8e9' : undefined,
                                                  color: netoACobrar <= 0 ? '#888' : '#2e7d32'
                                                }}>
                                                  ${netoACobrar.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                  {adelantosPendientes > 0 && (
                                                    <small className="d-block text-muted" style={{fontSize:'0.7rem',fontWeight:'normal'}}>
                                                      (desc. ${adelantosPendientes.toLocaleString('es-AR', {minimumFractionDigits: 2})})
                                                    </small>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  {estaPagado ? (
                                                    <span className="badge bg-success">✅ Completo</span>
                                                  ) : prof.totalPagado > 0 ? (
                                                    <span className="badge bg-warning text-dark">⚠️ Parcial</span>
                                                  ) : (
                                                    <span className="badge bg-danger">❌ Pendiente</span>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={estaSeleccionado}
                                                    onChange={() => handleToggleProfesional(prof)}
                                                    disabled={estaPagado}
                                                  />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* Renderizar subobras */}
                                {presupuesto.subobras && presupuesto.subobras.map((subobra, subobraIdx) => {
                                  const profesionalesSubobra = profesionalesFiltradosPorSemana.filter(
                                    p => p.presupuestoId === subobra.id
                                  );

                                  if (profesionalesSubobra.length === 0) return null;

                                  const totalAPagarSubobra = profesionalesSubobra.reduce((sum, p) => sum + (p.importeCalculado || 0), 0);
                                  const totalPagadoSubobra = profesionalesSubobra.reduce((sum, p) => sum + (p.totalPagado || 0), 0);
                                  const saldoSubobra = totalAPagarSubobra - totalPagadoSubobra;

                                  return (
                                    <div key={subobra.id} className="mt-3 ms-4">
                                      {/* Encabezado de Subobra */}
                                      <div className="card border-secondary border-opacity-50">
                                        <div className="card-header bg-secondary bg-opacity-10">
                                          <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                              <h6 className="mb-0">
                                                <i className="bi bi-diagram-3 me-2 text-primary"></i>
                                                {subobra.nombreObra}
                                              </h6>
                                              <small className="text-muted">
                                                <i className="bi bi-geo-alt me-1"></i>
                                                {subobra.direccionObra}
                                              </small>
                                            </div>
                                            <div className="text-end">
                                              <div className="badge bg-secondary">
                                                {profesionalesSubobra.length} profesional(es)
                                              </div>
                                              <div className="mt-1">
                                                <small className="text-muted">Saldo: </small>
                                                <strong>${saldoSubobra.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="card-body p-0">
                                          <div className="table-responsive">
                                            <table className="table table-hover table-bordered mb-0 table-sm">
                                              <tbody>
                                                {profesionalesSubobra.map((prof, profIdx) => {
                                                  const esSeleccionado = profesionalesSeleccionados.some(
                                                    p => (p.uniqueId || `${p.presupuestoId}-${p.profesionalId || p.id}`) === (prof.uniqueId || `${prof.presupuestoId}-${prof.profesionalId || prof.id}`)
                                                  );

                                                  const diasTrabajados = prof.diasTrabajadosConFeriados || prof.diasTrabajados || 0;
                                                  const diasHabiles = prof.diasHabiles !== undefined ? prof.diasHabiles : diasTrabajados;
                                                  const totalFeriados = diasTrabajados - diasHabiles;
                                                  const hayFeriados = totalFeriados > 0;
                                                  const diasAUsar = mostrarSoloHabiles ? diasHabiles : diasTrabajados;

                                                  const totalAPagar = mostrarSoloHabiles
                                                    ? (diasHabiles * (prof.tarifaPorDia || prof.precioJornal || 0))
                                                    : (prof.importeCalculado || 0);
                                                  const estaPagado = (prof.totalPagado || 0) >= (prof.importeCalculado || 0) - 0.01;
                                                  const saldoPendiente = (prof.importeCalculado || 0) - (prof.totalPagado || 0);
                                                  const saldoAjustado = mostrarSoloHabiles
                                                    ? totalAPagar - (prof.totalPagado || 0)
                                                    : saldoPendiente;
                                                  const adelantosPendientesSubobra = prof.adelantosPendientes || 0;
                                                  const netoACobrarSubobra = Math.max(0, saldoAjustado - adelantosPendientesSubobra);

                                                  return (
                                                    <tr key={prof.uniqueId || profIdx} className={esSeleccionado ? 'table-active' : ''}>
                                                      <td style={{width:'120px'}}>{prof.tipoProfesional}</td>
                                                      <td style={{width:'150px'}}>{prof.nombreCompleto || prof.nombre || 'Sin nombre'}</td>
                                                      <td className="text-center" style={{width:'120px'}}>
                                                        <span className="fw-bold">{diasAUsar}</span>
                                                      </td>
                                                      <td className="text-end" style={{width:'120px'}}>${(prof.tarifaPorDia || prof.precioJornal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                      <td className="text-end fw-bold" style={{width:'120px'}}>
                                                        ${totalAPagar.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                      </td>
                                                      <td className="text-end text-success" style={{width:'120px'}}>${(prof.totalPagado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                      <td className="text-end text-danger" style={{width:'120px'}}>
                                                        ${saldoAjustado.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                      </td>
                                                      <td className="text-end" style={{width:'120px', color: adelantosPendientesSubobra > 0 ? '#e65100' : '#aaa'}}>
                                                        {adelantosPendientesSubobra > 0
                                                          ? `-$\u00A0${adelantosPendientesSubobra.toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                                          : <span className="text-muted">—</span>
                                                        }
                                                      </td>
                                                      <td className="text-end fw-bold" style={{
                                                        width:'130px',
                                                        backgroundColor: adelantosPendientesSubobra > 0 ? '#f1f8e9' : undefined,
                                                        color: netoACobrarSubobra <= 0 ? '#888' : '#2e7d32'
                                                      }}>
                                                        ${netoACobrarSubobra.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                        {adelantosPendientesSubobra > 0 && (
                                                          <small className="d-block text-muted" style={{fontSize:'0.7rem',fontWeight:'normal'}}>
                                                            (desc. ${adelantosPendientesSubobra.toLocaleString('es-AR', {minimumFractionDigits: 2})})
                                                          </small>
                                                        )}
                                                      </td>
                                                      <td className="text-center" style={{width:'100px'}}>
                                                        {estaPagado ? (
                                                          <span className="badge bg-success">✅ Completo</span>
                                                        ) : prof.totalPagado > 0 ? (
                                                          <span className="badge bg-warning text-dark">⚠️ Parcial</span>
                                                        ) : (
                                                          <span className="badge bg-danger">❌ Pendiente</span>
                                                        )}
                                                      </td>
                                                      <td className="text-center" style={{width:'80px'}}>
                                                        <input
                                                          type="checkbox"
                                                          className="form-check-input"
                                                          checked={esSeleccionado}
                                                          onChange={() => handleToggleProfesional(prof)}
                                                          disabled={estaPagado}
                                                        />
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Separador entre grupos de obras - línea negra */}
                                {presupuestoIdx < presupuestosArray.length - 1 && (
                                  <hr style={{borderTop: '3px solid #000', margin: '1.5rem 0'}} />
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                  {/* TAB MATERIALES */}
                  {tabActiva === 'MATERIALES' && (
                    <>
                      {materialesFiltradosPorSemana.length === 0 ? (
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          {semanaSeleccionada === 0
                            ? 'No hay materiales en las obras seleccionadas'
                            : `No hay materiales asignados a la semana ${semanaSeleccionada}`}
                        </div>
                      ) : (
                        <>
                          {/* Agrupar materiales por obra */}
                          {presupuestos.map((presupuesto, presupuestoIdx) => {
                            const materialesObra = materialesFiltradosPorSemana.filter(
                              m => m.presupuestoId === presupuesto.id
                            );

                            if (materialesObra.length === 0) return null;

                            const totalAPagarObra = materialesObra.reduce((sum, m) => sum + (m.importeCalculado || 0), 0);
                            const totalPagadoObra = materialesObra.reduce((sum, m) => sum + (m.totalPagado || 0), 0);
                            const saldoObra = totalAPagarObra - totalPagadoObra;

                            return (
                              <div key={presupuesto.id} className="mb-4">
                                {/* Encabezado de Obra */}
                                <div className="card border-success">
                                  <div className="card-header bg-success text-white">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <div>
                                        <h6 className="mb-0">
                                          <i className="bi bi-building me-2"></i>
                                          {presupuesto.nombreObra}
                                        </h6>
                                        <small>
                                          <i className="bi bi-geo-alt me-1"></i>
                                          {presupuesto.direccionObra}
                                        </small>
                                      </div>
                                      <div className="text-end">
                                        <div className="badge bg-light text-dark">
                                          {materialesObra.length} material(es)
                                        </div>
                                        <div className="mt-1">
                                          <small className="text-white-50">Saldo: </small>
                                          <strong>${saldoObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="card-body p-0">
                                    <div className="table-responsive">
                                      <table className="table table-hover table-bordered mb-0">
                                        <thead style={{backgroundColor:'#f8f9fa'}}>
                                          <tr>
                                            <th style={{minWidth:'200px',padding:'8px'}}>Tipo de Material</th>
                                            <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Cantidad</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Precio Unitario</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Total a Pagar</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Total Pagado</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Saldo Pendiente</th>
                                            <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Estado Pago</th>
                                            <th style={{minWidth:'80px',padding:'8px',textAlign:'center'}}>
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={materialesObra.every(m => materialesSeleccionados.some(
                                                  sel => sel.uniqueId === m.uniqueId
                                                ))}
                                                onChange={() => {
                                                  const todosSeleccionados = materialesObra.every(m => materialesSeleccionados.some(
                                                    sel => sel.uniqueId === m.uniqueId
                                                  ));
                                                  if (todosSeleccionados) {
                                                    // Deseleccionar todos de esta obra
                                                    setMaterialesSeleccionados(materialesSeleccionados.filter(
                                                      sel => !materialesObra.some(m => sel.uniqueId === m.uniqueId)
                                                    ));
                                                  } else {
                                                    // Seleccionar todos de esta obra
                                                    const nuevosSeleccionados = [...materialesSeleccionados];
                                                    materialesObra.forEach(m => {
                                                      if (!nuevosSeleccionados.some(sel => sel.uniqueId === m.uniqueId)) {
                                                        nuevosSeleccionados.push(m);
                                                      }
                                                    });
                                                    setMaterialesSeleccionados(nuevosSeleccionados);
                                                  }
                                                }}
                                                disabled={saldoObra === 0}
                                              />
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {materialesObra.map((mat, idx) => {
                                            const estaSeleccionado = materialesSeleccionados.some(m => m.uniqueId === mat.uniqueId);
                                            const saldoPendiente = (mat.importeCalculado || 0) - (mat.totalPagado || 0);
                                            const estaPagado = saldoPendiente <= 0 && (mat.importeCalculado || 0) > 0;

                                            return (
                                              <tr key={mat.uniqueId} className={estaPagado ? 'table-success' : ''}>
                                                <td>
                                                  {mat.tipoMaterial}
                                                  {estaPagado && (
                                                    <span className="badge bg-success ms-2">✅ PAGADO</span>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  <span className="fw-bold">{mat.cantidad}</span>
                                                </td>
                                                <td className="text-end">${mat.precioUnitario.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end fw-bold">${mat.importeCalculado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end text-success">${mat.totalPagado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end text-danger">${saldoPendiente.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-center">
                                                  {estaPagado ? (
                                                    <span className="badge bg-success">✅ Completo</span>
                                                  ) : mat.totalPagado > 0 ? (
                                                    <span className="badge bg-warning text-dark">⚠️ Parcial</span>
                                                  ) : (
                                                    <span className="badge bg-danger">❌ Pendiente</span>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={estaSeleccionado}
                                                    onChange={() => {
                                                      if (estaSeleccionado) {
                                                        setMaterialesSeleccionados(materialesSeleccionados.filter(m => m.uniqueId !== mat.uniqueId));
                                                      } else {
                                                        setMaterialesSeleccionados([...materialesSeleccionados, mat]);
                                                      }
                                                    }}
                                                    disabled={estaPagado}
                                                  />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* Separador entre obras (excepto la última) */}
                                {presupuestoIdx < presupuestos.length - 1 && <hr className="my-4" />}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                  {/* TAB OTROS COSTOS */}
                  {tabActiva === 'OTROS_COSTOS' && (
                    <>
                      {otrosCostosFiltradosPorSemana.length === 0 ? (
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          {semanaSeleccionada === 0
                            ? 'No hay otros costos en las obras seleccionadas'
                            : `No hay otros costos asignados a la semana ${semanaSeleccionada}`}
                        </div>
                      ) : (
                        <>
                          {/* Agrupar otros costos por obra */}
                          {presupuestos.map((presupuesto, presupuestoIdx) => {
                            const costosObra = otrosCostosFiltradosPorSemana.filter(
                              c => c.presupuestoId === presupuesto.id
                            );

                            if (costosObra.length === 0) return null;

                            const totalAPagarObra = costosObra.reduce((sum, c) => sum + (c.importeCalculado || 0), 0);
                            const totalPagadoObra = costosObra.reduce((sum, c) => sum + (c.totalPagado || 0), 0);
                            const saldoObra = totalAPagarObra - totalPagadoObra;

                            return (
                              <div key={presupuesto.id} className="mb-4">
                                {/* Encabezado de Obra */}
                                <div className="card border-warning">
                                  <div className="card-header bg-warning text-dark">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <div>
                                        <h6 className="mb-0">
                                          <i className="bi bi-building me-2"></i>
                                          {presupuesto.nombreObra}
                                        </h6>
                                        <small>
                                          <i className="bi bi-geo-alt me-1"></i>
                                          {presupuesto.direccionObra}
                                        </small>
                                      </div>
                                      <div className="text-end">
                                        <div className="badge bg-light text-dark">
                                          {costosObra.length} costo(s)
                                        </div>
                                        <div className="mt-1">
                                          <small>Saldo: </small>
                                          <strong>${saldoObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="card-body p-0">
                                    <div className="table-responsive">
                                      <table className="table table-hover table-bordered mb-0">
                                        <thead style={{backgroundColor:'#f8f9fa'}}>
                                          <tr>
                                            <th style={{minWidth:'200px',padding:'8px'}}>Descripción</th>
                                            <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Cantidad</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Precio Unitario</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Total a Pagar</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Total Pagado</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Saldo Pendiente</th>
                                            <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Estado Pago</th>
                                            <th style={{minWidth:'80px',padding:'8px',textAlign:'center'}}>
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={costosObra.every(c => otrosCostosSeleccionados.some(
                                                  sel => sel.uniqueId === c.uniqueId
                                                ))}
                                                onChange={() => {
                                                  const todosSeleccionados = costosObra.every(c => otrosCostosSeleccionados.some(
                                                    sel => sel.uniqueId === c.uniqueId
                                                  ));
                                                  if (todosSeleccionados) {
                                                    // Deseleccionar todos de esta obra
                                                    setOtrosCostosSeleccionados(otrosCostosSeleccionados.filter(
                                                      sel => !costosObra.some(c => sel.uniqueId === c.uniqueId)
                                                    ));
                                                  } else {
                                                    // Seleccionar todos de esta obra
                                                    const nuevosSeleccionados = [...otrosCostosSeleccionados];
                                                    costosObra.forEach(c => {
                                                      if (!nuevosSeleccionados.some(sel => sel.uniqueId === c.uniqueId)) {
                                                        nuevosSeleccionados.push(c);
                                                      }
                                                    });
                                                    setOtrosCostosSeleccionados(nuevosSeleccionados);
                                                  }
                                                }}
                                                disabled={saldoObra === 0}
                                              />
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {costosObra.map((costo, idx) => {
                                            const estaSeleccionado = otrosCostosSeleccionados.some(c => c.uniqueId === costo.uniqueId);
                                            const saldoPendiente = (costo.importeCalculado || 0) - (costo.totalPagado || 0);
                                            const estaPagado = saldoPendiente <= 0 && (costo.importeCalculado || 0) > 0;

                                            // Calcular cantidad y precio unitario
                                            const cantidad = costo.cantidadAsignada || 1;
                                            const precioUnitario = cantidad > 0 ? (costo.importeCalculado / cantidad) : costo.importeCalculado;

                                            return (
                                              <tr key={costo.uniqueId} className={estaPagado ? 'table-success' : ''}>
                                                <td>
                                                  {costo.descripcion}
                                                  {estaPagado && (
                                                    <span className="badge bg-success ms-2">✅ PAGADO</span>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  <span className="fw-bold">{cantidad}</span>
                                                </td>
                                                <td className="text-end">${precioUnitario.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end fw-bold">${costo.importeCalculado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end text-success">${costo.totalPagado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-end text-danger">${saldoPendiente.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                                <td className="text-center">
                                                  {estaPagado ? (
                                                    <span className="badge bg-success">✅ Completo</span>
                                                  ) : costo.totalPagado > 0 ? (
                                                    <span className="badge bg-warning text-dark">⚠️ Parcial</span>
                                                  ) : (
                                                    <span className="badge bg-danger">❌ Pendiente</span>
                                                  )}
                                                </td>
                                                <td className="text-center">
                                                  <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={estaSeleccionado}
                                                    onChange={() => {
                                                      if (estaSeleccionado) {
                                                        setOtrosCostosSeleccionados(otrosCostosSeleccionados.filter(c => c.uniqueId !== costo.uniqueId));
                                                      } else {
                                                        setOtrosCostosSeleccionados([...otrosCostosSeleccionados, costo]);
                                                      }
                                                    }}
                                                    disabled={estaPagado}
                                                  />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* Separador entre obras (excepto la última) */}
                                {presupuestoIdx < presupuestos.length - 1 && <hr className="my-4" />}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* OBRAS INDEPENDIENTES */}
                {(() => {
                  const obrasIndependientes = trabajosExtraFiltradosPorSemana.filter(t => t.esObraIndependiente === true);
                  const totalAPagarObrasIndep = obrasIndependientes.reduce((sum, t) => sum + (t.totalCalculado || 0), 0);
                  const totalPagadoObrasIndep = obrasIndependientes.reduce((sum, t) => sum + (t.totalPagado || 0), 0);
                  const saldoObrasIndep = obrasIndependientes.reduce((sum, t) => sum + (t.saldo || 0), 0);

                  if (obrasIndependientes.length === 0) return null;

                  return (
                    <div className="mb-4">
                      <div className={`card ${saldoObrasIndep === 0 ? 'border-success' : 'border-warning'}`}>
                        <div className={`card-header ${saldoObrasIndep === 0 ? 'bg-success' : 'bg-warning'} text-dark`} style={{backgroundColor: saldoObrasIndep === 0 ? undefined : '#ffc107'}}>
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <h6 className="mb-0">
                                <i className="bi bi-hammer me-2"></i>
                                🏗️ OBRAS INDEPENDIENTES (Sin Presupuesto)
                              </h6>
                              <small>
                                <i className="bi bi-info-circle me-1"></i>
                                Obras registradas manualmente sin presupuesto previo
                              </small>
                            </div>
                            <div className="text-end">
                              <div className="badge bg-light text-dark">
                                {obrasIndependientes.length} obra(s) independiente(s)
                              </div>
                              <div className="mt-1">
                                <small>Saldo: </small>
                                <strong>${saldoObrasIndep.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="card-body p-0">
                          <div className="table-responsive">
                            <table className="table table-hover table-bordered mb-0">
                              <thead style={{backgroundColor:'#fff3cd'}}>
                                <tr>
                                  <th style={{minWidth:'250px',padding:'8px'}}>Obra Independiente</th>
                                  <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Importe Estimado</th>
                                  <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Pagado</th>
                                  <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Saldo</th>
                                  <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Estado</th>
                                  <th style={{minWidth:'80px',padding:'8px',textAlign:'center'}}>
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      checked={obrasIndependientes.every(t =>
                                        trabajosExtraSeleccionados.includes(t.id)
                                      )}
                                      onChange={() => toggleTodosTrabajoObra(obrasIndependientes)}
                                      disabled={saldoObrasIndep === 0}
                                    />
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {obrasIndependientes.map((obra) => {
                                  const totalObra = obra.totalCalculado || 0;
                                  const totalPagado = obra.totalPagado || 0;
                                  const saldo = obra.saldo || 0;
                                  const porcentajePagado = totalObra > 0 ? (totalPagado / totalObra) * 100 : 0;
                                  const estaSeleccionado = trabajosExtraSeleccionados.includes(obra.id);
                                  const estaPagado = saldo <= 0;

                                  return (
                                    <tr key={obra.id}>
                                      <td style={{padding:'8px'}}>
                                        <div className="d-flex align-items-start">
                                          <div className="flex-grow-1">
                                            <div className="fw-bold">
                                              {obra.nombre}
                                            </div>
                                            {obra.direccion && (
                                              <small className="text-muted d-block mt-1">
                                                <i className="bi bi-geo-alt me-1"></i>
                                                {obra.direccion}
                                              </small>
                                            )}
                                            <div className="mt-1">
                                              <span className="badge bg-warning text-dark me-2">
                                                🏗️ Obra Independiente
                                              </span>
                                              <span className="badge bg-info text-white">
                                                ℹ️ Sin Presupuesto Previo
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </td>

                                      <td style={{padding:'8px',textAlign:'right'}}>
                                        <strong className="text-primary">
                                          ${totalObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                        </strong>
                                        <br />
                                        <small className="text-muted">(Estimado)</small>
                                      </td>

                                      <td style={{padding:'8px',textAlign:'right'}}>
                                        <span className="text-success">
                                          ${totalPagado.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                        </span>
                                      </td>

                                      <td style={{padding:'8px',textAlign:'right'}}>
                                        <strong className={saldo > 0 ? 'text-warning' : 'text-muted'}>
                                          ${saldo.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                        </strong>
                                      </td>

                                      <td style={{padding:'8px',textAlign:'center'}}>
                                        {obra.estadoPago === 'PAGADO_TOTAL' ? (
                                          <span className="badge bg-success">✅ Completo</span>
                                        ) : obra.estadoPago === 'PAGADO_PARCIAL' ? (
                                          <span className="badge bg-warning text-dark">
                                            <i className="bi bi-clock-history me-1"></i>
                                            Parcial ({porcentajePagado.toFixed(0)}%)
                                          </span>
                                        ) : (
                                          <span className="badge bg-danger">
                                            <i className="bi bi-exclamation-circle me-1"></i>
                                            Pendiente
                                          </span>
                                        )}
                                      </td>

                                      <td style={{padding:'8px',textAlign:'center'}}>
                                        <input
                                          type="checkbox"
                                          className="form-check-input"
                                          checked={estaSeleccionado}
                                          onChange={() => toggleTrabajoExtra(obra.id)}
                                          disabled={estaPagado}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>

                              <tfoot style={{backgroundColor:'#fff3cd'}}>
                                <tr>
                                  <td style={{padding:'8px',textAlign:'right'}}>
                                    <strong>TOTAL OBRAS INDEPENDIENTES:</strong>
                                  </td>
                                  <td style={{padding:'8px',textAlign:'right'}}>
                                    <strong className="text-primary">
                                      ${totalAPagarObrasIndep.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                    </strong>
                                  </td>
                                  <td style={{padding:'8px',textAlign:'right'}}>
                                    <strong className="text-success">
                                      ${totalPagadoObrasIndep.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                    </strong>
                                  </td>
                                  <td style={{padding:'8px',textAlign:'right'}}>
                                    <strong className="text-warning">
                                      ${saldoObrasIndep.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                    </strong>
                                  </td>
                                  <td colSpan="2"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Agrupar trabajos adicionales por obra */}
                {trabajosExtraFiltradosPorSemana.some(t => t.esObraIndependiente !== true) && (
                  <div className="mt-4">
                    {presupuestos.map((presupuesto, presupuestoIdx) => {
                            // 🔥 Filtrar trabajos adicionales de esta obra (NO obras independientes)
                            const trabajosObra = trabajosExtraFiltradosPorSemana.filter(
                              t => t.presupuestoId === presupuesto.id && t.esObraIndependiente !== true
                            );

                            if (trabajosObra.length === 0) return null;

                            // Nota: t.totalCalculado y t.saldo ya vienen ajustados (cuota o total)
                            const totalAPagarObra = trabajosObra.reduce((sum, t) => sum + (t.totalCalculado || 0), 0);
                            const totalPagadoObra = trabajosObra.reduce((sum, t) => sum + (t.totalPagado || 0), 0);
                            const saldoObra = trabajosObra.reduce((sum, t) => sum + (t.saldo || 0), 0); // Sumar saldos directos

                            return (
                              <div key={presupuesto.id} className="mb-4">
                                {/* Encabezado de Obra */}
                                <div className={`card ${saldoObra === 0 ? 'border-success' : 'border-info'}`}>
                                  <div className={`card-header ${saldoObra === 0 ? 'bg-success' : 'bg-info'} text-white`}>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <div>
                                        <h6 className="mb-0">
                                          <i className="bi bi-building me-2"></i>
                                          {presupuesto.nombreObra}
                                        </h6>
                                        <small>
                                          <i className="bi bi-geo-alt me-1"></i>
                                          {presupuesto.direccionObra}
                                        </small>
                                      </div>
                                      <div className="text-end">
                                        <div className="badge bg-light text-dark">
                                          {trabajosObra.length} trabajo(s) adicional(es)
                                        </div>
                                        <div className="mt-1">
                                          <small className="text-white-50">Saldo: </small>
                                          <strong>${saldoObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="card-body p-0">
                                    <div className="table-responsive">
                                      <table className="table table-hover table-bordered mb-0">
                                        <thead style={{backgroundColor:'#f8f9fa'}}>
                                          <tr>
                                            <th style={{minWidth:'250px',padding:'8px'}}>Trabajo Adicional</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Importe a Pagar</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Pagado</th>
                                            <th style={{minWidth:'120px',padding:'8px',textAlign:'right'}}>Saldo</th>
                                            <th style={{minWidth:'100px',padding:'8px',textAlign:'center'}}>Estado</th>
                                            <th style={{minWidth:'80px',padding:'8px',textAlign:'center'}}>
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={trabajosObra.every(t =>
                                                  trabajosExtraSeleccionados.includes(t.id)
                                                )}
                                                onChange={() => toggleTodosTrabajoObra(trabajosObra)}
                                                disabled={saldoObra === 0}
                                              />
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {trabajosObra.map((trabajo) => {
                                            // 🔥 Usar directamente los valores del trabajo (ya ajustados por semana en useMemo)
                                            const totalTrabajo = trabajo.totalCalculado || 0;
                                            const totalPagado = trabajo.totalPagado || 0;
                                            const saldo = trabajo.saldo || 0; // Ya calculado en useMemo considerando cuotas semanales
                                            const porcentajePagado = totalTrabajo > 0 ? (totalPagado / totalTrabajo) * 100 : 0;
                                            const estaSeleccionado = trabajosExtraSeleccionados.includes(trabajo.id);
                                            const estaPagado = saldo <= 0;

                                            return (
                                              <React.Fragment key={trabajo.id}>
                                                <tr>
                                                  <td style={{padding:'8px'}}>
                                                    <div className="d-flex align-items-start">
                                                      <div className="flex-grow-1">
                                                        <div className="fw-bold">
                                                          {trabajo.nombre}
                                                        </div>
                                                        {trabajo.descripcion && (
                                                          <small className="text-muted d-block mt-1">
                                                            {trabajo.descripcion}
                                                          </small>
                                                        )}
                                                        {/* Badge de origen */}
                                                        <div className="mt-1">
                                                          {trabajo.trabajoExtraId ? (
                                                            <span className="badge bg-success me-2">
                                                              🔧 De Trabajo Extra
                                                            </span>
                                                          ) : (
                                                            <span className="badge bg-primary me-2">
                                                              🏗️ De Obra Principal
                                                            </span>
                                                          )}
                                                          {/* Badge de estado del trabajo */}
                                                          {trabajo.estado && (
                                                            <span className={`badge ${
                                                              trabajo.estado === 'COMPLETADO' ? 'bg-success' :
                                                              trabajo.estado === 'EN_PROGRESO' ? 'bg-warning' :
                                                              trabajo.estado === 'CANCELADO' ? 'bg-danger' :
                                                              'bg-secondary'
                                                            }`}>
                                                              {trabajo.estado === 'COMPLETADO' ? '✅ Completado' :
                                                               trabajo.estado === 'EN_PROGRESO' ? '⏳ En Progreso' :
                                                               trabajo.estado === 'CANCELADO' ? '❌ Cancelado' :
                                                               '⏸️ Pendiente'}
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </td>

                                                  <td style={{padding:'8px',textAlign:'right'}}>
                                                    <strong className="text-primary">
                                                      ${totalTrabajo.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </strong>
                                                  </td>

                                                  <td style={{padding:'8px',textAlign:'right'}}>
                                                    <span className="text-success">
                                                      ${totalPagado.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </span>
                                                  </td>

                                                  <td style={{padding:'8px',textAlign:'right'}}>
                                                    <strong className={saldo > 0 ? 'text-warning' : 'text-muted'}>
                                                      ${saldo.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </strong>
                                                  </td>

                                                  <td style={{padding:'8px',textAlign:'center'}}>
                                                    {trabajo.estadoPago === 'PAGADO_TOTAL' ? (
                                                      <span className="badge bg-success">✅ Completo</span>
                                                    ) : trabajo.estadoPago === 'PAGADO_PARCIAL' ? (
                                                      <span className="badge bg-warning text-dark">
                                                        <i className="bi bi-clock-history me-1"></i>
                                                        Parcial ({porcentajePagado.toFixed(0)}%)
                                                      </span>
                                                    ) : (
                                                      <span className="badge bg-danger">
                                                        <i className="bi bi-exclamation-circle me-1"></i>
                                                        Pendiente
                                                      </span>
                                                    )}
                                                  </td>

                                                  <td style={{padding:'8px',textAlign:'center'}}>
                                                    <input
                                                      type="checkbox"
                                                      className="form-check-input"
                                                      checked={estaSeleccionado}
                                                      onChange={() => toggleTrabajoExtra(trabajo.id)}
                                                      disabled={estaPagado}
                                                    />
                                                  </td>
                                                </tr>
                                              </React.Fragment>
                                            );
                                          })}
                                        </tbody>

                                        <tfoot style={{backgroundColor:'#e9ecef'}}>
                                          <tr>
                                            <td style={{padding:'8px',textAlign:'right'}}>
                                              <strong>TOTAL OBRA:</strong>
                                            </td>
                                            <td style={{padding:'8px',textAlign:'right'}}>
                                              <strong className="text-primary">
                                                ${totalAPagarObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </strong>
                                            </td>
                                            <td style={{padding:'8px',textAlign:'right'}}>
                                              <strong className="text-success">
                                                ${totalPagadoObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </strong>
                                            </td>
                                            <td style={{padding:'8px',textAlign:'right'}}>
                                              <strong className="text-warning">
                                                ${saldoObra.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </strong>
                                            </td>
                                            <td colSpan="2"></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* Separador entre obras (excepto la última) */}
                                {presupuestoIdx < presupuestos.length - 1 && <hr className="my-4" />}
                              </div>
                            );
                          })}
                    </div>
                  )}

                {/* Resumen de selección */}
                {(profesionalesSeleccionados.length > 0 || materialesSeleccionados.length > 0 || otrosCostosSeleccionados.length > 0 || trabajosExtraSeleccionados.length > 0) && (
                  <div className="card bg-success text-white mt-3">
                    <div className="card-body">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <h5 className="mb-0">
                            <i className="bi bi-check-circle me-2"></i>
                            Items seleccionados
                          </h5>
                          <div className="mt-2">
                            {profesionalesSeleccionados.length > 0 && (
                              <div><small>👷 {profesionalesSeleccionados.length} profesional(es)</small></div>
                            )}
                            {materialesSeleccionados.length > 0 && (
                              <div><small>🧱 {materialesSeleccionados.length} material(es)</small></div>
                            )}
                            {otrosCostosSeleccionados.length > 0 && (
                              <div><small>📋 {otrosCostosSeleccionados.length} otro(s) costo(s)</small></div>
                            )}
                            {trabajosExtraSeleccionados.length > 0 && (
                              <div><small>🔧 {trabajosExtraSeleccionados.length} trabajo(s) extra</small></div>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6 text-end">
                          <h3 className="mb-0">
                            <i className="bi bi-cash-coin me-2"></i>
                            ${calcularTotalSeleccionados().toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </h3>
                          <small>Total a pagar</small>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onHide}
              disabled={loading}
            >
              <i className="bi bi-x-circle me-1"></i>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={loading || (profesionalesSeleccionados.length === 0 && materialesSeleccionados.length === 0 && otrosCostosSeleccionados.length === 0 && trabajosExtraSeleccionados.length === 0)}
            >
              <i className="bi bi-cash-stack me-1"></i>
              Pagar a Todos (${calcularTotalSeleccionados().toLocaleString('es-AR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarPagoConsolidadoModal;
