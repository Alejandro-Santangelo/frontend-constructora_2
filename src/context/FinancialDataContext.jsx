import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import { listarPagosPorProfesional } from '../services/pagosProfesionalObraService';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { esFeriado, esDiaHabil } from '../utils/feriadosArgentina';

/**
 * 🏦 FINANCIAL DATA CONTEXT
 * 
 * Contexto centralizado para gestionar TODOS los datos financieros
 * - Tarjetas de estadísticas
 * - Datos de modales
 * - Sincronización en tiempo real
 * - Caché inteligente
 * 
 * BENEFICIOS:
 * ✅ Una sola fuente de verdad para todos los componentes
 * ✅ Actualización automática y sincronizada
 * ✅ Sin duplicación de requests
 * ✅ Gestión eficiente de memoria
 */

// 📅 Calcular número de semana desde fecha de inicio
const calcularNumeroSemana = (fechaAsignacion, fechaInicio) => {
  if (!fechaAsignacion || !fechaInicio) return null;
  
  const inicio = new Date(fechaInicio);
  const asignacion = new Date(fechaAsignacion);
  
  // Calcular diferencia en días
  const diffMs = asignacion - inicio;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Calcular semana (día 0-6 = semana 1, día 7-13 = semana 2, etc.)
  const semana = Math.floor(diffDays / 7) + 1;
  
  return semana > 0 ? semana : 1;
};

const FinancialDataContext = createContext(null);

export const useFinancialData = () => {
  const context = useContext(FinancialDataContext);
  if (!context) {
    throw new Error('useFinancialData debe usarse dentro de FinancialDataProvider');
  }
  return context;
};

export const FinancialDataProvider = ({ children }) => {
  const { empresaSeleccionada } = useEmpresa();
  
  // 🎯 ESTADO CENTRALIZADO
  const [obraActual, setObraActual] = useState(null);
  const [datosFinancieros, setDatosFinancieros] = useState({
    presupuesto: null,
    estadisticas: {
      totalPresupuesto: 0,
      totalCobrado: 0,
      totalPagado: 0,
      saldoDisponible: 0,
      porcentajeCobrado: 0,
      porcentajePagado: 0,
      porcentajeDisponible: 0,
      alertas: []
    },
    cobros: [],
    pagos: [],
    pagosConsolidados: [],
    profesionales: [],
    materiales: [],
    otrosCostos: [],
    cajaChica: null,
    timestamp: 0
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 🔒 Control de cargas
  const cargandoRef = useRef(false);
  const debounceTimerRef = useRef(null);
  
  // 🔄 FUNCIÓN PRINCIPAL: Cargar todos los datos financieros de una obra
  const cargarDatosObra = useCallback(async (obra, forzar = false) => {
    if (!obra?.direccionObra?.presupuestoNoClienteId || !empresaSeleccionada?.id) {
      
      return;
    }
    
    // Evitar cargas duplicadas
    if (cargandoRef.current && !forzar) {
      return;
    }
    
    const presupuestoId = obra.direccionObra.presupuestoNoClienteId;
    
    // Si es la misma obra y los datos son recientes (< 5 segundos), usar caché
    if (!forzar && 
        datosFinancieros.presupuesto?.id === presupuestoId &&
        (Date.now() - datosFinancieros.timestamp) < 5000) {
      console.log('📦 [FinancialContext] Usando datos en caché (< 5 segundos)');
      return;
    }
    
    cargandoRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // 1️⃣ CARGAR PRESUPUESTO COMPLETO
      const presupuesto = await api.presupuestosNoCliente.getById(
        presupuestoId,
        empresaSeleccionada.id
      );
      
      
      
      if (!presupuesto) {
        throw new Error('No se pudo cargar el presupuesto');
      }
      
      // Variables para identificar la obra en todas sus versiones
      // Priorizar datos del objeto 'obra' que se pasó como parámetro
      const nombreObra = obra.nombreObra || obra.nombre || presupuesto.nombreObra || presupuesto.nombre || '';
      const direccionObraId = obra.direccionObra?.id || presupuesto.direccionObra?.id;
      
      
      
      // 2️⃣ CALCULAR TOTAL PRESUPUESTO
      console.log('🔍 [FinancialContext] Presupuesto recibido del backend:', {
        id: presupuesto.id,
        totalPresupuesto: presupuesto.totalPresupuesto,
        totalPresupuestoConHonorarios: presupuesto.totalPresupuestoConHonorarios,
        totalHonorarios: presupuesto.totalHonorarios,
        totalMayoresCostos: presupuesto.totalMayoresCostos,
        montoTotal: presupuesto.montoTotal
      });
      const totalPresupuesto = calcularTotalPresupuesto(presupuesto);
      console.log('💰 [FinancialContext] Total calculado para estadísticas:', totalPresupuesto);
      
      // 3️⃣ CARGAR COBROS DE TODAS LAS VERSIONES DE ESTA OBRA (mismo nombre)
      let cobrosObra = [];
      let totalCobrado = 0;
      
      try {
        const response = await api.get('/api/v1/cobros-obra', { 
          params: { empresaId: empresaSeleccionada.id } 
        });
        
        const todosLosCobros = Array.isArray(response) ? response : 
                              response?.data ? response.data :
                              response?.cobros ? response.cobros : [];
        
        if (nombreObra) {
          // Obtener todos los presupuestos con el mismo nombre
          const todosPresupuestos = await api.get('/api/v1/presupuestos-no-cliente', {
            params: { empresaId: empresaSeleccionada.id }
          });
          
          const presupuestosArray = Array.isArray(todosPresupuestos) ? todosPresupuestos : todosPresupuestos?.data || [];
          const presupuestosMismaObra = presupuestosArray.filter(p => 
            p.nombreObra === nombreObra || p.nombre === nombreObra
          );
          const idsPresupuestosObra = new Set(presupuestosMismaObra.map(p => p.id));
          
          cobrosObra = todosLosCobros.filter(c => 
            c.presupuestoNoClienteId && 
            idsPresupuestosObra.has(c.presupuestoNoClienteId) &&
            c.estado?.toUpperCase() === 'COBRADO'
          );
        } else {
          // Sin nombre, buscar solo en presupuesto actual
          cobrosObra = todosLosCobros.filter(c => 
            c.presupuestoNoClienteId === presupuestoId &&
            c.estado?.toUpperCase() === 'COBRADO'
          );
        }
        
        totalCobrado = cobrosObra.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
        console.log(`✅ [FinancialContext] Cargados ${cobrosObra.length} cobros - Total: $${totalCobrado}`);
        
      } catch (err) {
        console.error('❌ Error cargando cobros (continuando sin cobros):', err);
        cobrosObra = [];
        totalCobrado = 0;
      }
      
      // 4️⃣ CARGAR DATOS REALES DE PROFESIONALES, MATERIALES Y OTROS COSTOS ASIGNADOS
      let materialesData = [];
      let otrosCostosData = [];
      let profesionalesData = [];
      
      
      
      // 🎯 CARGAR PROFESIONALES ASIGNADOS REALES (NO del presupuesto)
      // Los profesionales deben venir de la tabla de asignaciones con importes específicos
      const obraId = obra.id || obra.obraId;
      
      if (obraId) {
        // 🎯 CARGAR PROFESIONALES ASIGNADOS desde /api/profesionales/asignaciones/{obraId}
        // Este endpoint trae los datos completos por día trabajado
        try {
          console.log(`📊 [FinancialContext] Cargando asignaciones desde /api/profesionales/asignaciones/${obraId}`);
          
          const asignacionesCompletas = await api.get(`/api/profesionales/asignaciones/${obraId}`, {
            params: { empresaId: empresaSeleccionada.id }
          });
          
          const asignaciones = Array.isArray(asignacionesCompletas) ? asignacionesCompletas : 
                              asignacionesCompletas?.data || [];
          
          console.log(`✅ [FinancialContext] Asignaciones cargadas (${asignaciones.length} registros):`, asignaciones);
          
          // 🔥 CARGAR PRECIOS REALES DESDE LA TABLA PROFESIONALES
          const profesionalesPorId = new Map();
          
          try {
            const todosProfesionales = await api.profesionales.getAll(empresaSeleccionada.id);
            const profesionalesArray = Array.isArray(todosProfesionales) ? todosProfesionales : 
                                       todosProfesionales?.data || [];
            
            profesionalesArray.forEach(prof => {
              if (prof.id && prof.valorHoraDefault) {
                profesionalesPorId.set(prof.id, {
                  id: prof.id,
                  nombre: prof.nombre,
                  tipo: prof.tipoProfesional,
                  valorHoraDefault: prof.valorHoraDefault
                });
              }
            });
            
            console.log(`💰 [FinancialContext] Cargados ${profesionalesPorId.size} profesionales con precios reales`);
          } catch (err) {
            console.error('❌ Error cargando profesionales:', err);
          }
          
          // Procesar asignaciones por semana y día
          const profesionalesMap = new Map();
          
          asignaciones.forEach((asignacion) => {
            const asignacionesPorSemana = asignacion.asignacionesPorSemana || [];
            
            asignacionesPorSemana.forEach((semana) => {
              const detalles = semana.detallesPorDia || [];
              
              detalles.forEach(detalle => {
                const profId = detalle.profesionalId;
                const key = `prof-${profId}`;
                
                // 🗓️ Validar si el día es hábil (excluye feriados y fines de semana)
                const fechaDetalle = detalle.fecha;
                const esHabil = esDiaHabil(fechaDetalle);
                const esFeriadoDia = esFeriado(fechaDetalle);
                
                if (!profesionalesMap.has(key)) {
                  const tipo = detalle.profesionalTipo || 'Sin tipo';
                  
                  // 🔥 BUSCAR PRECIO REAL: 1) del detalle, 2) valor_hora_default de la tabla profesionales
                  let importeJornal = detalle.importeJornal || 0;
                  
                  if (importeJornal === 0) {
                    const profesionalReal = profesionalesPorId.get(profId);
                    if (profesionalReal?.valorHoraDefault) {
                      importeJornal = profesionalReal.valorHoraDefault;
                      console.log(`💰 [FinancialContext] Usando valor_hora_default para ${detalle.profesionalNombre}: $${importeJornal}`);
                    }
                  }
                  
                  profesionalesMap.set(key, {
                    asignacionId: asignacion.asignacionId, // ✅ ID de la tabla asignaciones_profesional_obra
                    profesionalId: profId,
                    tipoProfesional: tipo,
                    nombreProfesional: detalle.profesionalNombre || 'Sin nombre',
                    importePorJornal: importeJornal,
                    totalJornales: 0,
                    totalJornalesHabiles: 0, // 🔥 Solo días hábiles
                    totalDiasFeriados: 0 // 🔥 Contador de feriados
                  });
                }
                
                const prof = profesionalesMap.get(key);
                // Contar 1 jornal por día trabajado
                prof.totalJornales += 1;
                
                // 🗓️ Incrementar contadores según tipo de día
                if (esHabil) {
                  prof.totalJornalesHabiles += 1;
                } else if (esFeriadoDia) {
                  prof.totalDiasFeriados += 1;
                }
              });
            });
          });
          
          // Convertir mapa a array con formato final y agregar desglose semanal
          profesionalesData = Array.from(profesionalesMap.values()).map((prof) => {
            console.log(`🔍 [DEBUG Semanas] Procesando prof: ${prof.nombreProfesional} (ID: ${prof.profesionalId})`);
            
            // Calcular desglose por semana
            const semanas = [];
            const diasPorSemana = new Map();
            
            // Reagrupar días trabajados por semana (usando Set para evitar duplicados)
            console.log(`🔍 [DEBUG Semanas] Total asignaciones:`, asignaciones.length);
            asignaciones.forEach((asignacion, idx) => {
              console.log(`🔍 [DEBUG Semanas] Asignación ${idx}:`, {
                asignacionId: asignacion.asignacionId,
                tieneAsignacionesPorSemana: !!asignacion.asignacionesPorSemana,
                cantidadSemanas: asignacion.asignacionesPorSemana?.length
              });
              
              if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
                asignacion.asignacionesPorSemana.forEach((semana, semIdx) => {
                  const semanaKey = semana.semanaKey;
                  console.log(`🔍 [DEBUG Semanas] Semana ${semIdx}: ${semanaKey}, detalles:`, semana.detallesPorDia?.length);
                  
                  if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
                    // Filtrar detalles que corresponden a este profesional
                    const detallesProfesional = semana.detallesPorDia.filter(
                      detalle => detalle.profesionalId === prof.profesionalId && detalle.cantidad > 0 && detalle.fecha
                    );
                    
                    console.log(`🔍 [DEBUG Semanas] Prof ${prof.profesionalId} en semana ${semanaKey}: ${detallesProfesional.length} detalles`);
                    
                    if (detallesProfesional.length > 0) {
                      console.log(`🔍 [DEBUG Semanas] ✅ Agregando semana ${semanaKey} para ${prof.nombreProfesional}`);
                      
                      // Inicializar semana si no existe
                      if (!diasPorSemana.has(semanaKey)) {
                        // Extraer número de semana desde semanaKey (ej: "2025-W52" -> 52)
                        const numeroSemana = semanaKey ? parseInt(semanaKey.split('-W')[1]) : 0;
                        
                        // Calcular fecha inicio y fin desde las fechas de los detalles
                        const fechasOrdenadas = detallesProfesional.map(d => d.fecha).sort();
                        
                        diasPorSemana.set(semanaKey, {
                          semanaKey: semanaKey,
                          numeroSemana: numeroSemana,
                          fechaInicio: fechasOrdenadas[0],
                          fechaFin: fechasOrdenadas[fechasOrdenadas.length - 1],
                          fechasUnicas: new Set(),
                        });
                      }
                      
                      const semanaData = diasPorSemana.get(semanaKey);
                      
                      // Agregar fechas únicas y actualizar fechaInicio/fechaFin
                      detallesProfesional.forEach(detalle => {
                        semanaData.fechasUnicas.add(detalle.fecha);
                        // Actualizar fechaInicio y fechaFin para incluir todas las fechas
                        if (!semanaData.fechaInicio || detalle.fecha < semanaData.fechaInicio) {
                          semanaData.fechaInicio = detalle.fecha;
                        }
                        if (!semanaData.fechaFin || detalle.fecha > semanaData.fechaFin) {
                          semanaData.fechaFin = detalle.fecha;
                        }
                      });
                    }
                  }
                });
              }
            });
            
            // Convertir a array y calcular montos
            diasPorSemana.forEach((semanaData, key) => {
              const diasTrabajados = semanaData.fechasUnicas.size;
              semanas.push({
                semanaKey: semanaData.semanaKey,
                numeroSemana: semanaData.numeroSemana,
                fechaInicio: semanaData.fechaInicio,
                fechaFin: semanaData.fechaFin,
                diasTrabajados: diasTrabajados,
                fechas: Array.from(semanaData.fechasUnicas),
                montoSemana: diasTrabajados * prof.importePorJornal,
                pagado: false,
                montoPagado: 0
              });
            });
            
            // Ordenar por número de semana
            semanas.sort((a, b) => (a.numeroSemana || 0) - (b.numeroSemana || 0));
            
            return {
              id: `${obraId}-asig-${prof.profesionalId}`,
              profesionalId: prof.profesionalId,
              profesionalObraId: prof.asignacionId,
              tipo: prof.tipoProfesional,
              tipoProfesional: prof.tipoProfesional,
              nombre: prof.nombreProfesional,
              nombreCompleto: prof.nombreProfesional,
              cantidadJornales: prof.totalJornales,
              precioJornal: prof.importePorJornal,
              precioTotal: prof.totalJornales * prof.importePorJornal,
              totalProfesional: prof.totalJornales * prof.importePorJornal,
              totalPagado: 0,
              saldoPendiente: prof.totalJornales * prof.importePorJornal,
              categoria: 'PROFESIONALES',
              observaciones: '',
              semanas: semanas // 🔥 NUEVO: Desglose semanal
            };
          });
          
          // 🗓️ Resumen de feriados detectados
          const profesionalesArray = Array.from(profesionalesMap.values());
          const totalFeriadosDetectados = profesionalesArray.reduce((sum, p) => sum + (p.totalDiasFeriados || 0), 0);
          const profesionalesConFeriados = profesionalesArray.filter(p => p.totalDiasFeriados > 0).length;
          
          console.log(`✅ [FinancialContext] Procesados ${profesionalesData.length} profesionales`);
          if (totalFeriadosDetectados > 0) {
            console.log(`🗓️ [FinancialContext] FERIADOS: ${totalFeriadosDetectados} día(s) feriado en ${profesionalesConFeriados} profesional(es)`);
          }
          if (profesionalesData.length > 0) {
            console.log('📊 [FinancialContext] PRIMER PROFESIONAL:', profesionalesData[0]);
            console.log('  - profesionalId:', profesionalesData[0].profesionalId);
            console.log('  - profesionalObraId:', profesionalesData[0].profesionalObraId);
            console.log('  - asignacionId desde mapa:', Array.from(profesionalesMap.values())[0]?.asignacionId);
          }
          
        } catch (err) {
          console.error('❌ Error cargando asignaciones completas:', err);
          console.log('⚠️ Intentando con endpoint de asignaciones semanales...');
          
          // Fallback: usar endpoint de asignaciones semanales
          try {
          const { obtenerAsignacionesSemanalPorObra } = await import('../services/profesionalesObraService');
          const asignacionesResponse = await obtenerAsignacionesSemanalPorObra(obraId, empresaSeleccionada.id);
          
          const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : 
                              asignacionesResponse?.data || [];
          
          console.log(`✅ [FinancialContext] Cargados ${asignaciones.length} profesionales ASIGNADOS de obra #${obraId}`);
          console.log(`🔍 [DEBUG] Respuesta completa del backend:`, JSON.stringify(asignaciones, null, 2));
          
          // Mapear asignaciones reales a formato esperado
          // El backend retorna solo IDs y cantidades, necesitamos obtener datos del presupuesto
          profesionalesData = [];
          const profesionalesMap = new Map();
          
          // 🔥 CARGAR PRECIOS REALES DESDE LA TABLA PROFESIONALES
          const profesionalesPorId = new Map();
          
          try {
            const todosProfesionales = await api.profesionales.getAll(empresaSeleccionada.id);
            const profesionalesArray = Array.isArray(todosProfesionales) ? todosProfesionales : 
                                       todosProfesionales?.data || [];
            
            profesionalesArray.forEach(prof => {
              if (prof.id && prof.valorHoraDefault) {
                profesionalesPorId.set(prof.id, {
                  id: prof.id,
                  nombre: prof.nombre,
                  tipo: prof.tipoProfesional,
                  valorHoraDefault: prof.valorHoraDefault
                });
              }
            });
            
            console.log(`💰 [FinancialContext] Cargados ${profesionalesPorId.size} profesionales con precios reales`);
          } catch (err) {
            console.error('❌ Error cargando profesionales:', err);
          }
          
          console.log(`📊 [FinancialContext] Profesionales del presupuesto:`, profesionalesDelPresupuesto);
          
          // Paso 2: Acumular jornales de las asignaciones reales
          // ✅ AHORA EL BACKEND INCLUYE profesionalNombre y profesionalTipo
          asignaciones.forEach((asignacion) => {
            console.log(`🔍 [DEBUG] Procesando asignación ID: ${asignacion.asignacionId}`);
            console.log(`🔍 [DEBUG] asignacion COMPLETA:`, asignacion);
            const asignacionesPorSemana = asignacion.asignacionesPorSemana || [];
            
            asignacionesPorSemana.forEach((semana) => {
              console.log(`🔍 [DEBUG] Semana: ${semana.semanaKey}`);
              const detalles = semana.detallesPorDia || [];
              console.log(`🔍 [DEBUG] Detalles por día:`, detalles);
              
              detalles.forEach(detalle => {
                console.log(`🔍 [DEBUG] Detalle:`, {
                  fecha: detalle.fecha,
                  profesionalId: detalle.profesionalId,
                  profesionalNombre: detalle.profesionalNombre,
                  cantidad: detalle.cantidad,
                  importeJornal: detalle.importeJornal
                });
                
                const profId = detalle.profesionalId;
                const key = `prof-${profId}`;
                
                if (!profesionalesMap.has(key)) {
                  // ✅ Usar datos que vienen del backend (profesionalNombre, profesionalTipo, importeJornal)
                  const tipo = detalle.profesionalTipo || 'Sin tipo';
                  
                  // 🔥 BUSCAR PRECIO REAL: 1) del detalle, 2) valor_hora_default de la tabla profesionales
                  let importeJornal = detalle.importeJornal || 0;
                  
                  if (importeJornal === 0) {
                    const profesionalReal = profesionalesPorId.get(profId);
                    if (profesionalReal?.valorHoraDefault) {
                      importeJornal = profesionalReal.valorHoraDefault;
                      console.log(`💰 [FinancialContext] Usando valor_hora_default para ${detalle.profesionalNombre}: $${importeJornal}`);
                    }
                  }
                  
                  profesionalesMap.set(key, {
                    asignacionId: asignacion.asignacionId, // ✅ CORRECTO: ID de la tabla asignaciones_profesional_obra
                    profesionalId: profId,
                    tipoProfesional: tipo,
                    nombreProfesional: detalle.profesionalNombre || 'Sin nombre',
                    importePorJornal: importeJornal,
                    totalJornales: 0
                  });
                  console.log(`🔍 [DEBUG] Creado profesional en mapa:`, profesionalesMap.get(key));
                }
                
                const prof = profesionalesMap.get(key);
                const cantidadAnterior = prof.totalJornales;
                // ✅ Contar 1 jornal por día trabajado (cada detalle es un día)
                prof.totalJornales += 1;
                console.log(`🔍 [DEBUG] ${prof.nombreProfesional}: ${cantidadAnterior} + 1 día = ${prof.totalJornales} jornales`);
              });
            });
          });
          
          // Paso 3: Convertir mapa a array con formato final y agregar desglose semanal
          profesionalesData = Array.from(profesionalesMap.values()).map((prof) => {
            // Calcular desglose por semana
            const semanas = [];
            const diasPorSemana = new Map();
            
            // Reagrupar días trabajados por semana (usando Set para evitar duplicados)
            asignaciones.forEach((asignacion) => {
              if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
                asignacion.asignacionesPorSemana.forEach((semana) => {
                  const semanaKey = semana.semanaKey;
                  
                  if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
                    // Filtrar detalles que corresponden a este profesional
                    const detallesProfesional = semana.detallesPorDia.filter(
                      detalle => detalle.profesionalId === prof.profesionalId && detalle.cantidad > 0 && detalle.fecha
                    );
                    
                    console.log(`🔍 [DEBUG Semanas] Prof ${prof.profesionalId} en semana ${semanaKey}: ${detallesProfesional.length} detalles`);
                    
                    if (detallesProfesional.length > 0) {
                      console.log(`🔍 [DEBUG Semanas] ✅ Agregando semana ${semanaKey} para ${prof.nombreProfesional}`);
                      // Inicializar semana si no existe
                      if (!diasPorSemana.has(semanaKey)) {
                        // Extraer número de semana desde semanaKey (ej: "2025-W52" -> 52)
                        const numeroSemana = semanaKey ? parseInt(semanaKey.split('-W')[1]) : 0;
                        
                        // Calcular fecha inicio y fin desde las fechas de los detalles
                        const fechasOrdenadas = detallesProfesional.map(d => d.fecha).sort();
                        
                        diasPorSemana.set(semanaKey, {
                          semanaKey: semanaKey,
                          numeroSemana: numeroSemana,
                          fechaInicio: fechasOrdenadas[0],
                          fechaFin: fechasOrdenadas[fechasOrdenadas.length - 1],
                          fechasUnicas: new Set(),
                        });
                      }
                      
                      const semanaData = diasPorSemana.get(semanaKey);
                      
                      // Agregar fechas únicas y actualizar fechaInicio/fechaFin
                      detallesProfesional.forEach(detalle => {
                        semanaData.fechasUnicas.add(detalle.fecha);
                        // Actualizar fechaInicio y fechaFin para incluir todas las fechas
                        if (!semanaData.fechaInicio || detalle.fecha < semanaData.fechaInicio) {
                          semanaData.fechaInicio = detalle.fecha;
                        }
                        if (!semanaData.fechaFin || detalle.fecha > semanaData.fechaFin) {
                          semanaData.fechaFin = detalle.fecha;
                        }
                      });
                    }
                  }
                });
              }
            });
            
            // Convertir a array y calcular montos
            diasPorSemana.forEach((semanaData, key) => {
              const diasTrabajados = semanaData.fechasUnicas.size;
              semanas.push({
                semanaKey: semanaData.semanaKey,
                numeroSemana: semanaData.numeroSemana,
                fechaInicio: semanaData.fechaInicio,
                fechaFin: semanaData.fechaFin,
                diasTrabajados: diasTrabajados,
                fechas: Array.from(semanaData.fechasUnicas),
                montoSemana: diasTrabajados * prof.importePorJornal,
                pagado: false,
                montoPagado: 0
              });
            });
            
            // Ordenar por número de semana
            semanas.sort((a, b) => (a.numeroSemana || 0) - (b.numeroSemana || 0));
            
            return {
              id: `${obraId}-asig-${prof.profesionalId}`,
              profesionalId: prof.profesionalId,
              profesionalObraId: prof.asignacionId,
              tipo: prof.tipoProfesional,
              tipoProfesional: prof.tipoProfesional,
              nombre: prof.nombreProfesional,
              nombreCompleto: prof.nombreProfesional,
              cantidadJornales: prof.totalJornales,
              precioJornal: prof.importePorJornal,
              precioTotal: prof.totalJornales * prof.importePorJornal,
              totalProfesional: prof.totalJornales * prof.importePorJornal,
              totalPagado: 0,
              saldoPendiente: prof.totalJornales * prof.importePorJornal,
              categoria: 'PROFESIONALES',
              observaciones: '',
              semanas: semanas // 🔥 NUEVO: Desglose semanal
            };
          });
          
          console.log(`📊 [FinancialContext] Procesados ${profesionalesData.length} profesionales únicos`);
          if (profesionalesData.length > 0) {
            console.log('📊 [FinancialContext] PRIMER PROFESIONAL MAPEADO:', profesionalesData[0]);
          }
          
          } catch (err) {
            console.error('❌ Error cargando profesionales asignados:', err);
            // Fallback: si falla la carga de asignaciones, usar datos del presupuesto como backup
            console.warn('⚠️ Usando datos de profesionales del presupuesto como fallback');
            const itemsCalculadora = presupuesto.itemsCalculadora || [];
            let contadorProfesionales = 0;
            for (const item of itemsCalculadora) {
              if (item.profesionales && Array.isArray(item.profesionales)) {
                for (const prof of item.profesionales) {
                  contadorProfesionales++;
                  
                  // ⚠️ VALIDACIÓN: profesionalObraId debe existir para poder registrar pagos
                  if (!prof.profesionalObraId) {
                    console.error('❌ Profesional sin profesionalObraId en presupuesto:', {
                      profesional: prof,
                      presupuestoId,
                      mensaje: 'El presupuesto debe ser aprobado y tener obra asignada antes de registrar pagos'
                    });
                  }
                  
                  profesionalesData.push({
                    id: `${presupuestoId}-${prof.id}-${contadorProfesionales}`,
                    profesionalId: prof.id,
                    profesionalObraId: prof.profesionalObraId, // ✅ Solo usar profesionalObraId del backend (debe venir del presupuesto aprobado)
                    itemId: item.id,
                    tipo: prof.tipo || item.tipoProfesional || 'Sin tipo',
                    nombre: prof.nombre || `${prof.tipo || item.tipoProfesional} #${contadorProfesionales}`,
                    cantidadJornales: prof.cantidadJornales || 0,
                    precioJornal: prof.importeJornal || 0,
                    precioTotal: (prof.cantidadJornales || 0) * (prof.importeJornal || 0),
                    categoria: 'PROFESIONALES'
                  });
                }
              }
            }
          }
        }
        
        // 📦 CARGAR MATERIALES: Usar presupuesto y enriquecer con asignaciones semanales
        try {
          // 1️⃣ Obtener fecha de inicio de la obra para calcular semanas
          let fechaInicioObra = presupuesto.fechaInicio || null;
          
          if (!fechaInicioObra) {
            try {
              const obraResponse = await api.get(`/api/obras/${obraId}`, {
                headers: { empresaId: empresaSeleccionada.id.toString() }
              });
              const obra = obraResponse?.data || obraResponse;
              fechaInicioObra = obra.fechaInicio || obra.fecha_inicio || obra.createdAt;
              console.log(`📅 [FinancialContext] Fecha inicio obra: ${fechaInicioObra}`);
            } catch (err) {
              console.warn('⚠️ [FinancialContext] No se pudo obtener fecha de inicio');
            }
          }
          
          // 2️⃣ Cargar materiales totales del presupuesto
          const materialesPresupuesto = await api.get(`/api/presupuestos-no-cliente/${presupuestoId}/materiales`, {
            headers: { empresaId: empresaSeleccionada.id.toString() }
          });
          
          const materialesArray = Array.isArray(materialesPresupuesto) ? materialesPresupuesto : 
                                 materialesPresupuesto?.data || [];
          
          console.log(`✅ [FinancialContext] Cargados ${materialesArray.length} materiales del presupuesto #${presupuestoId}`);
          
          // 3️⃣ Cargar asignaciones de materiales a la obra desde BD (tabla: obra_material)
          let asignacionesSemanales = [];
          try {
            const { obtenerMaterialesAsignados } = await import('../services/obraMaterialService');
            asignacionesSemanales = await obtenerMaterialesAsignados(obraId, empresaSeleccionada.id);
          } catch (err) {
            console.error('❌ [FinancialContext] Error cargando asignaciones de materiales:', err);
            asignacionesSemanales = [];
          }
          
          // 4️⃣ Crear mapa de asignaciones por materialId y CALCULAR semana desde fecha
          const asignacionesPorMaterial = new Map();
          asignacionesSemanales.forEach(asig => {
            const matId = asig.presupuestoMaterialId || asig.presupuesto_material_id || asig.materialCalculadoraId || asig.material_calculadora_id || asig.materialId;
            
            if (matId) {
              if (!asignacionesPorMaterial.has(matId)) {
                asignacionesPorMaterial.set(matId, []);
              }
              
              // Calcular semana desde fecha_asignacion
              const semanaCalculada = fechaInicioObra 
                ? calcularNumeroSemana(asig.fechaAsignacion || asig.fecha_asignacion, fechaInicioObra)
                : null;
              
              asignacionesPorMaterial.get(matId).push({
                semana: semanaCalculada,
                cantidad: asig.cantidadAsignada || asig.cantidad_asignada || asig.cantidad,
                fecha: asig.fechaAsignacion || asig.fecha_asignacion,
                observaciones: asig.observaciones
              });
            }
          });
          
          // 5️⃣ Mapear materiales del presupuesto con info de asignaciones
          materialesData = materialesArray.map((mat, idx) => {
            const asignaciones = asignacionesPorMaterial.get(mat.id) || [];
            
            // Calcular precio unitario si viene en 0
            const cantidad = mat.cantidad || 1;
            const subtotal = mat.subtotal || 0;
            const precioUnit = mat.precioUnitario || (cantidad > 0 ? subtotal / cantidad : 0);
            
            return {
              id: `${presupuestoId}-mat-${mat.id}`,
              materialId: mat.id,
              materialCalculadoraId: mat.id,
              nombre: mat.nombreMaterial || mat.descripcion || 'Sin nombre',
              cantidadUnidades: cantidad,
              precioUnidad: precioUnit,
              precioTotal: subtotal,
              unidad: mat.unidadMedida || 'u',
              categoria: 'MATERIALES',
              asignaciones: asignaciones, // Array de asignaciones por semana desde BD
              observaciones: mat.observaciones || ''
            };
          });
          
        } catch (err) {
          console.error('❌ [FinancialContext] Error cargando materiales:', err);
          console.error('❌ [FinancialContext] Detalles:', err.response?.data || err.message);
          const itemsCalculadora = presupuesto.itemsCalculadora || [];
          for (const item of itemsCalculadora) {
            if (item.materialesLista && Array.isArray(item.materialesLista)) {
              item.materialesLista.forEach((mat) => {
                materialesData.push({
                  id: `${presupuestoId}-mat-${mat.id}`,
                  materialCalculadoraId: mat.id,
                  nombre: mat.nombre || 'Sin nombre',
                  cantidadUnidades: mat.cantidad || 0,
                  precioUnidad: mat.precioUnitario || 0,
                  precioTotal: mat.subtotal || 0,
                  unidad: mat.unidad || 'u',
                  categoria: 'MATERIALES',
                  itemCalculadoraId: item.id
                });
              });
            }
          }
        }
      }
      
      // 💰 CARGAR OTROS COSTOS (gastos generales): presupuesto + asignaciones
      try {
        const obraId = obra.id || obra.obraId;
        
        // 1️⃣ Obtener fecha de inicio de la obra (puede ya estar cargada antes)
        let fechaInicioObra = presupuesto.fechaInicio || null;
        
        if (!fechaInicioObra) {
          try {
            const obraResponse = await api.get(`/api/obras/${obraId}`, {
              headers: { empresaId: empresaSeleccionada.id.toString() }
            });
            const obraData = obraResponse?.data || obraResponse;
            fechaInicioObra = obraData.fechaInicio || obraData.fecha_inicio || obraData.createdAt;
          } catch (err) {
            console.warn('⚠️ [FinancialContext] No se pudo obtener fecha de inicio para otros costos');
          }
        }
        
        // 2️⃣ Cargar gastos generales del presupuesto
        const gastosPresupuesto = await api.get(`/api/presupuestos-no-cliente/${presupuestoId}/gastos-generales`, {
          headers: { empresaId: empresaSeleccionada.id.toString() }
        });
        
        const gastosArray = Array.isArray(gastosPresupuesto) ? gastosPresupuesto : 
                           gastosPresupuesto?.data || [];
        
        console.log(`✅ [FinancialContext] Cargados ${gastosArray.length} gastos generales del presupuesto`);
        if (gastosArray.length > 0) {
          console.log('📋 [FinancialContext] Ejemplo de gasto:', gastosArray[0]);
        }
        
        // 3️⃣ Cargar asignaciones de gastos a la obra (obra_otro_costo)
        let asignacionesGastos = [];
        try {
          const asigResponse = await api.get(`/api/obras/${obraId}/otros-costos`, {
            headers: { empresaId: empresaSeleccionada.id.toString() }
          });
          asignacionesGastos = Array.isArray(asigResponse) ? asigResponse : asigResponse?.data || [];
          console.log(`✅ [FinancialContext] Cargadas ${asignacionesGastos.length} asignaciones de gastos desde BD`);
          if (asignacionesGastos.length > 0) {
            console.log('📋 [FinancialContext] Ejemplo asignación gasto:', asignacionesGastos[0]);
          }
        } catch (err) {
          console.warn('⚠️ [FinancialContext] No hay asignaciones de gastos en BD:', err.message);
        }
        
        // 4️⃣ Crear mapa de asignaciones por gastoGeneralId y CALCULAR semana
        const asignacionesPorGasto = new Map();
        console.log(`🔍 [FinancialContext] Procesando ${asignacionesGastos.length} asignaciones. fechaInicioObra: ${fechaInicioObra}`);
        
        asignacionesGastos.forEach(asig => {
          const gastoId = asig.gastoGeneralId || asig.gasto_general_id;
          if (gastoId) {
            if (!asignacionesPorGasto.has(gastoId)) {
              asignacionesPorGasto.set(gastoId, []);
            }
            
            // 🔥 CALCULAR SEMANA desde fecha_asignacion
            const semanaCalculada = fechaInicioObra 
              ? calcularNumeroSemana(asig.fechaAsignacion || asig.fecha_asignacion, fechaInicioObra)
              : null;
            
            const asignacionObj = {
              semana: semanaCalculada,
              importe: asig.importeAsignado || asig.importe_asignado,
              fecha: asig.fechaAsignacion || asig.fecha_asignacion,
              observaciones: asig.observaciones
            };
            
            console.log(`📋 [FinancialContext] Asignación procesada:`, {
              gastoId,
              fechaAsignacion: asig.fechaAsignacion || asig.fecha_asignacion,
              fechaInicio: fechaInicioObra,
              semanaCalculada,
              asignacionObj
            });
            
            asignacionesPorGasto.get(gastoId).push(asignacionObj);
          }
        });
        
        // 5️⃣ Mapear gastos del presupuesto con info de asignaciones
        otrosCostosData = gastosArray.map((gasto, idx) => {
          const asignaciones = asignacionesPorGasto.get(gasto.id) || [];
          
          // El backend trae "importe" como precio total
          const precioTotal = gasto.importe || gasto.subtotal || 0;
          
          return {
            id: `${presupuestoId}-gasto-${gasto.id}`,
            gastoId: gasto.id,
            gastoGeneralId: gasto.id,
            itemCalculadoraId: gasto.id, // 🔥 CRÍTICO: Usar el ID del gasto para matchear con pagos
            nombre: gasto.descripcion || 'Gasto General',
            cantidad: 1,
            precioUnitario: precioTotal,
            precioTotal: precioTotal,
            categoria: 'OTROS_COSTOS',
            tipo: gasto.categoria || gasto.tipoGasto || 'Gasto General',
            asignaciones: asignaciones, // 🔥 Array de asignaciones por semana CALCULADA
            observaciones: gasto.observaciones || '',
            nombreObra: presupuesto.nombreObra || presupuesto.nombre
          };
        });
        
        console.log(`✅ [FinancialContext] Procesados ${otrosCostosData.length} gastos con ${asignacionesPorGasto.size} asignaciones`);
        
      } catch (err) {
        console.error('❌ [FinancialContext] Error cargando gastos generales:', err);
        
        // Fallback: usar datos del presupuesto
        const itemsCalculadora = presupuesto.itemsCalculadora || [];
        
        for (const item of itemsCalculadora) {
          if (item.subtotalGastosGenerales && item.subtotalGastosGenerales > 0) {
            otrosCostosData.push({
              id: `${presupuestoId}-gasto-${item.id}`,
              nombre: item.descripcionGastosGenerales || item.nombreItem || 'Gastos Generales',
              precioTotal: item.subtotalGastosGenerales || 0,
              categoria: 'OTROS_COSTOS',
              tipo: item.tipoProfesional || 'Gastos Generales',
              itemCalculadoraId: item.id,
              observaciones: item.observacionesGastosGenerales
            });
          }
        }
      }
      
      // 5️⃣ CARGAR PAGOS DE TODAS LAS VERSIONES DE ESTA OBRA (mismo nombre)
      
      
      // 🎯 Identificador único de obra: direccionObraId + nombre
      // Versiones de la misma obra comparten nombre (ej: v29, v32 = "Casa de los Chianelli")
      
      console.log(`🔍 [Pagos] Iniciando carga de pagos. nombreObra: "${nombreObra}", profesionales: ${profesionalesData.length}`);
      
      const { listarPagosPorProfesionalObra } = await import('../services/pagosProfesionalObraService');
      let todosPagos = [];
      
      if (!nombreObra) {
        // Si no hay nombre, buscar solo por profesionales actuales
        console.warn('⚠️ No hay nombre de obra, buscando solo en versión actual');
        const profesionalesIds = profesionalesData.map(p => p.profesionalObraId).filter(Boolean);
        
        if (profesionalesIds.length > 0) {
          console.log(`🔍 [Pagos] Cargando pagos para ${profesionalesIds.length} profesionales:`, profesionalesIds);
          const pagosPorProfesional = await Promise.all(
            profesionalesIds.map(id => listarPagosPorProfesionalObra(id, empresaSeleccionada.id).catch(() => []))
          );
          todosPagos = pagosPorProfesional.flat();
        }
      } else {
        try {
          // Paso 1: Obtener TODOS los presupuestos de la empresa
          const todosPresupuestos = await api.get('/api/v1/presupuestos-no-cliente', {
            params: { empresaId: empresaSeleccionada.id }
          });
          
          const presupuestosArray = Array.isArray(todosPresupuestos) ? todosPresupuestos : 
                                    todosPresupuestos?.data || [];
          
          // Paso 2: Filtrar SOLO presupuestos con el MISMO NOMBRE (todas las versiones de esta obra)
          const presupuestosMismaObra = presupuestosArray.filter(p => 
            p.nombreObra === nombreObra || p.nombre === nombreObra
          );
          
          console.log(`🔍 [Pagos] Presupuestos con nombre "${nombreObra}": ${presupuestosMismaObra.length}`);
          
          // ⚠️ IMPORTANTE: Los profesionales están en asignaciones_profesional_obra, no en el presupuesto
          // Usar directamente los profesionalObraId de los profesionales ya cargados
          console.log(`🔍 [Pagos] Usando profesionales de la versión actual (obra ID: ${obraId})`);
          const profesionalesIds = profesionalesData.map(p => p.profesionalObraId).filter(Boolean);
          
          if (profesionalesIds.length > 0) {
            console.log(`🔍 [Pagos] Cargando pagos para ${profesionalesIds.length} profesionales:`, profesionalesIds);
            const pagosPorProfesional = await Promise.all(
              profesionalesIds.map(id => listarPagosPorProfesionalObra(id, empresaSeleccionada.id).catch(err => {
                console.warn(`⚠️ Error cargando pagos para profesional ${id}:`, err.message);
                return [];
              }))
            );
            todosPagos = pagosPorProfesional.flat();
            console.log(`✅ [Pagos] Total pagos cargados: ${todosPagos.length}`, todosPagos);
          }
          
          /* CÓDIGO ANTIGUO - Buscaba en itemsCalculadora pero los profesionales están en BD
          const profesionalesIdsTodasVersiones = [];
          
          for (const presup of presupuestosMismaObra) {
            try {
              const presupCompleto = await api.presupuestosNoCliente.getById(presup.id, empresaSeleccionada.id);
              const itemsCalc = presupCompleto.itemsCalculadora || [];
              
              for (const item of itemsCalc) {
                if (item.profesionales && Array.isArray(item.profesionales)) {
                  for (const prof of item.profesionales) {
                    if (prof.profesionalObraId) {
                      profesionalesIdsTodasVersiones.push(prof.profesionalObraId);
                    }
                  }
                }
              }
            } catch (err) {
              console.warn(`⚠️ Error cargando presupuesto v${presup.version}:`, err.message);
            }
          }
          
          console.log(`🔍 [Pagos] Profesionales encontrados en todas las versiones: ${profesionalesIdsTodasVersiones.length}`, profesionalesIdsTodasVersiones);
          
          // Paso 4: Buscar pagos de TODOS los profesionales de todas las versiones
          if (profesionalesIdsTodasVersiones.length > 0) {
            console.log(`🔍 [Pagos] Cargando pagos para ${profesionalesIdsTodasVersiones.length} profesionales (todas versiones)`);
            const pagosPorProfesional = await Promise.all(
              profesionalesIdsTodasVersiones.map(id => 
                listarPagosPorProfesionalObra(id, empresaSeleccionada.id)
                  .then(pagos => pagos || [])
                  .catch(() => [])
              )
            );
            
            todosPagos = pagosPorProfesional.flat();
            
          }
          */
          
        } catch (err) {
          console.error('❌ Error buscando pagos multi-versión:', err);
          
          // Fallback: buscar solo profesionales de versión actual
          const profesionalesIds = profesionalesData.map(p => p.profesionalObraId).filter(Boolean);
          if (profesionalesIds.length > 0) {
            console.log(`🔍 [Pagos FALLBACK] Cargando pagos para ${profesionalesIds.length} profesionales`);
            const pagosPorProfesional = await Promise.all(
              profesionalesIds.map(id => listarPagosPorProfesionalObra(id, empresaSeleccionada.id).catch(() => []))
            );
            todosPagos = pagosPorProfesional.flat();
          }
        }
      }
      
      const pagosValidos = todosPagos.filter(p => p.estado !== 'ANULADO');
      
      // Agrupar pagos por profesionalObraId para mapeo directo
      const pagosPorId = new Map();
      pagosValidos.forEach(pago => {
        const id = pago.profesionalObraId;
        if (!pagosPorId.has(id)) {
          pagosPorId.set(id, []);
        }
        pagosPorId.get(id).push(pago);
      });
      
      // Enriquecer profesionales con totales pagados
      console.log(`🔍 [Pagos] Enriqueciendo ${profesionalesData.length} profesionales con pagos`);
      console.log(`🔍 [Pagos] Map de pagos por ID:`, Array.from(pagosPorId.entries()).map(([k,v]) => `${k}: ${v.length} pago(s)`));
      
      profesionalesData.forEach((prof, idx) => {
        console.log(`🔍 [Pagos] Procesando ${prof.nombre} (profesionalObraId: ${prof.profesionalObraId})`);
        // Buscar pagos por profesionalObraId (mismo presupuesto)
        let pagosProf = pagosPorId.get(prof.profesionalObraId) || [];
        console.log(`🔍 [Pagos] Pagos encontrados para ${prof.nombre}: ${pagosProf.length}`, pagosProf);
        // Si no hay pagos por ID, buscar pagos de versiones anteriores por id_obra, tipo y nombre/posición
        if (pagosProf.length === 0) {
          for (let [id, pagosArr] of pagosPorId.entries()) {
            // Buscar pagos de profesionales con el mismo id_obra (obra base)
            let match = pagosArr.find((p, i) => {
              const idObraPago = p.id_obra || p.obra_id;
              const idObraActual = prof.idObra || prof.obra_id || prof.id_obra;
              const tipoMatch = p.tipo === prof.tipo;
              const nombreMatch = p.nombre === prof.nombre;
              const indexMatch = i === idx && tipoMatch;
              // Coincidencia por obra base, tipo y nombre/posición
              return (idObraPago === idObraActual) && ((tipoMatch && nombreMatch) || indexMatch);
            });
            // Si no hay match por nombre/índice, buscar por tipo y monto total
            if (!match) {
              match = pagosArr.find(p => {
                const idObraPago = p.id_obra || p.obra_id;
                const idObraActual = prof.idObra || prof.obra_id || prof.id_obra;
                const tipoMatch = p.tipo === prof.tipo;
                const montoMatch = parseFloat(p.montoBruto || p.montoNeto || p.montoPagado) === prof.precioTotal;
                return (idObraPago === idObraActual) && tipoMatch && montoMatch;
              });
            }
            if (match) {
              pagosProf = [match];
              break;
            }
          }
        }
        const totalPagado = pagosProf.reduce((sum, p) =>
          sum + (parseFloat(p.montoNeto || p.montoBruto || p.montoPagado) || 0), 0
        );
        prof.totalPagado = totalPagado;
        prof.saldo = prof.precioTotal - totalPagado;
        console.log(`✅ [Pagos] ${prof.nombre}: totalPagado=$${totalPagado}, precioTotal=$${prof.precioTotal}, saldo=$${prof.saldo}`);
        
        // 🔥 ACTUALIZAR montoPagado de cada semana con pagos reales
        if (prof.semanas && prof.semanas.length > 0 && pagosProf.length > 0) {
          pagosProf.forEach(pago => {
            // Buscar a qué semana corresponde este pago por las observaciones
            const match = pago.observaciones?.match(/SEMANA (\d+)/i);
            if (match) {
              const numeroSemana = parseInt(match[1]);
              const semana = prof.semanas.find(s => s.numeroSemana === numeroSemana);
              if (semana) {
                const montoPago = parseFloat(pago.montoNeto || pago.montoBruto || 0);
                semana.montoPagado = (semana.montoPagado || 0) + montoPago;
                semana.pagado = semana.montoPagado >= semana.montoSemana;
                console.log(`  💰 Actualizando semana ${numeroSemana} de ${prof.nombre}: +$${montoPago}, total pagado=$${semana.montoPagado}`);
              }
            }
          });
        }
      });
      
      console.log(`✅ [Pagos] Profesionales actualizados:`, profesionalesData.map(p => ({
        nombre: p.nombre,
        totalPagado: p.totalPagado,
        saldo: p.saldo
      })));
      
      // LOG: Resumen de carga
      if (pagosValidos.length > 0) {
        
      }
      
      const totalPagadoProfesionales = pagosValidos.reduce((sum, p) => 
        sum + (parseFloat(p.montoNeto || p.montoBruto || p.montoPagado) || 0), 0
      );
      
      // 6️⃣ CARGAR PAGOS CONSOLIDADOS DE TODAS LAS VERSIONES (mismo nombre)
      let pagosConsolidados = [];
      
      try {
        const { listarPagosConsolidadosPorPresupuesto } = await import('../services/pagosConsolidadosService');
        
        if (nombreObra) {
          try {
            // Obtener todos los presupuestos con el mismo nombre
            const todosPresupuestos = await api.get('/api/v1/presupuestos-no-cliente', {
              params: { empresaId: empresaSeleccionada.id }
            });
            
            const presupuestosArray = Array.isArray(todosPresupuestos) ? todosPresupuestos : todosPresupuestos?.data || [];
            const presupuestosMismaObra = presupuestosArray.filter(p => 
              p.nombreObra === nombreObra || p.nombre === nombreObra
            );
            
            // Cargar pagos consolidados de cada versión
            const pagosPorVersion = await Promise.all(
              presupuestosMismaObra.map(p => 
                listarPagosConsolidadosPorPresupuesto(p.id, empresaSeleccionada.id)
                  .then(res => Array.isArray(res) ? res : (res?.data || []))
                  .catch(() => [])
              )
            );
            
            pagosConsolidados = pagosPorVersion.flat();
          } catch (err) {
            console.error('❌ Error cargando pagos consolidados multi-versión (continuando):', err);
            let fallback = await listarPagosConsolidadosPorPresupuesto(presupuestoId, empresaSeleccionada.id).catch(() => []);
            pagosConsolidados = Array.isArray(fallback) ? fallback : (fallback?.data || []);
          }
        } else {
          // Sin nombre, buscar solo en presupuesto actual
          pagosConsolidados = await listarPagosConsolidadosPorPresupuesto(presupuestoId, empresaSeleccionada.id).catch(() => []);
        }
        
        // 🔥 Si pagosConsolidados es un objeto response, extraer .data
        if (pagosConsolidados && pagosConsolidados.data && Array.isArray(pagosConsolidados.data)) {
          pagosConsolidados = pagosConsolidados.data;
        }
        
        console.log(`✅ [FinancialContext] Cargados ${pagosConsolidados?.length || 0} pagos consolidados`);
        console.log('📦 [FinancialContext] Pagos consolidados recibidos:', pagosConsolidados);
        
        // Log detallado de cada pago
        if (pagosConsolidados && pagosConsolidados.length > 0) {
          pagosConsolidados.forEach((pago, idx) => {
            console.log(`📋 Pago ${idx + 1}:`, {
              id: pago.id,
              tipoPago: pago.tipoPago,
              concepto: pago.concepto,
              monto: pago.monto,
              itemCalculadoraId: pago.itemCalculadoraId,
              gastoGeneralCalculadoraId: pago.gastoGeneralCalculadoraId,
              gastoGeneralId: pago.gastoGeneralId,
              materialCalculadoraId: pago.materialCalculadoraId,
              observaciones: pago.observaciones
            });
          });
        }
        
      } catch (err) {
        console.error('❌ Error cargando pagos consolidados (continuando sin pagos consolidados):', err);
        pagosConsolidados = [];
      }
      
      const pagosValidosConsolidados = pagosConsolidados.filter(p => p.estado !== 'ANULADO');
      
      // Marcar materiales como pagados y calcular total
      let totalPagadoMateriales = 0;
      materialesData.forEach(mat => {
        const pagosMaterial = pagosValidosConsolidados.filter(
          p => p.tipoPago === 'MATERIALES' && p.materialCalculadoraId === mat.materialCalculadoraId
        );
        const totalPagadoMat = pagosMaterial.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
        mat.pagado = totalPagadoMat >= mat.precioTotal;
        mat.pagosParciales = totalPagadoMat > 0 && totalPagadoMat < mat.precioTotal;
        mat.totalPagado = totalPagadoMat;
        mat.saldoPendiente = mat.precioTotal - totalPagadoMat;
        
        // Identificar semanas pagadas (extrayendo [SEMANA X] de observaciones)
        mat.semanasPagadas = new Set();
        mat.tienePagoTotal = false; // Flag para pagos sin marcador de semana
        
        pagosMaterial.forEach(pago => {
          const match = pago.observaciones?.match(/\[SEMANA (\d+)\]/);
          if (match) {
            mat.semanasPagadas.add(parseInt(match[1]));
          } else if (pago.monto > 0) {
            // Si hay un pago SIN marcador de semana, se considera PAGO TOTAL
            mat.tienePagoTotal = true;
          }
        });
        
        totalPagadoMateriales += totalPagadoMat;
      });
      
      // Marcar otros costos como pagados y calcular total
      let totalPagadoOtrosCostos = 0;
      otrosCostosData.forEach(costo => {
        const pagosCosto = pagosValidosConsolidados.filter(
          p => (p.tipoPago === 'OTROS_COSTOS' || p.tipoPago === 'GASTOS_GENERALES') && 
               (p.gastoGeneralCalculadoraId === costo.gastoGeneralId ||
                p.gastoGeneralId === costo.gastoGeneralId ||
                p.gastoGeneralCalculadoraId === costo.gastoId ||
                p.gastoGeneralId === costo.gastoId)
        );
        
        console.log(`🔍 [FinancialContext] Analizando costo: ${costo.nombre}`, {
          gastoId: costo.gastoId,
          gastoGeneralId: costo.gastoGeneralId,
          pagosCostoEncontrados: pagosCosto.length,
          pagos: pagosCosto.map(p => ({
            id: p.id,
            monto: p.monto,
            gastoGeneralCalculadoraId: p.gastoGeneralCalculadoraId,
            gastoGeneralId: p.gastoGeneralId,
            observaciones: p.observaciones
          }))
        });
        
        const totalPagadoCosto = pagosCosto.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
        costo.pagado = totalPagadoCosto >= costo.precioTotal;
        costo.pagosParciales = totalPagadoCosto > 0 && totalPagadoCosto < costo.precioTotal;
        costo.totalPagado = totalPagadoCosto;
        costo.saldoPendiente = costo.precioTotal - totalPagadoCosto;
        
        // 🔥 Parsear semanas pagadas desde observaciones [SEMANA X]
        costo.semanasPagadas = new Set();
        costo.tienePagoTotal = false;
        
        pagosCosto.forEach(pago => {
          const observaciones = pago.observaciones || '';
          const matchSemana = observaciones.match(/\[SEMANA (\d+)\]/);
          
          if (matchSemana) {
            const numSemana = parseInt(matchSemana[1]);
            costo.semanasPagadas.add(numSemana);
          } else {
            // Si hay un pago SIN marcador de semana, se considera PAGO TOTAL
            costo.tienePagoTotal = true;
          }
        });
        
        totalPagadoOtrosCostos += totalPagadoCosto;
      });
      
      const totalPagado = totalPagadoProfesionales + totalPagadoMateriales + totalPagadoOtrosCostos;
      
      console.log('💰 [FinancialContext] RESUMEN DE PAGOS:', {
        totalPagadoProfesionales: `$${totalPagadoProfesionales.toFixed(2)}`,
        totalPagadoMateriales: `$${totalPagadoMateriales.toFixed(2)}`,
        totalPagadoOtrosCostos: `$${totalPagadoOtrosCostos.toFixed(2)}`,
        totalPagado: `$${totalPagado.toFixed(2)}`,
        cantidadPagosProfesionales: pagosValidos.length,
        cantidadPagosConsolidados: pagosValidosConsolidados.length,
        desglosePagosConsolidados: {
          materiales: pagosValidosConsolidados.filter(p => p.tipoPago === 'MATERIALES').length,
          gastosGenerales: pagosValidosConsolidados.filter(p => p.tipoPago === 'GASTOS_GENERALES').length,
          otrosCostos: pagosValidosConsolidados.filter(p => p.tipoPago === 'OTROS_COSTOS').length
        }
      });
      
      // 7️⃣ CALCULAR ESTADÍSTICAS
      const saldoDisponible = totalCobrado - totalPagado;
      const porcentajeCobrado = totalPresupuesto > 0 ? (totalCobrado / totalPresupuesto) * 100 : 0;
      const porcentajePagado = totalPresupuesto > 0 ? (totalPagado / totalPresupuesto) * 100 : 0;
      const porcentajeDisponible = totalPresupuesto > 0 ? (saldoDisponible / totalPresupuesto) * 100 : 0;
      
      // 8️⃣ GENERAR ALERTAS
      const alertas = generarAlertas({
        totalPresupuesto,
        totalCobrado,
        totalPagado,
        saldoDisponible,
        porcentajeCobrado,
        porcentajePagado,
        porcentajeDisponible
      });
      
      // 9️⃣ ACTUALIZAR ESTADO CENTRALIZADO
      const nuevosDatos = {
        presupuesto: {
          ...presupuesto,
          obraId: obra.id || obra.obraId // 🔥 Asegurar que obraId esté disponible para modales
        },
        estadisticas: {
          totalPresupuesto,
          totalCobrado,
          totalPagado,
          saldoDisponible,
          porcentajeCobrado,
          porcentajePagado,
          porcentajeDisponible,
          alertas,
          cantidadCobros: cobrosObra.length,
          cantidadPagos: todosPagos.length + pagosValidosConsolidados.length
        },
        cobros: cobrosObra,
        pagos: todosPagos,
        pagosConsolidados: pagosValidosConsolidados,
        profesionales: profesionalesData,
        materiales: materialesData,
        otrosCostos: otrosCostosData,
        timestamp: Date.now()
      };
      
      setDatosFinancieros(nuevosDatos);
      setObraActual(obra);
      
    } catch (err) {
      console.error('❌ [FinancialContext] Error cargando datos:', err);
      setError(err.message || 'Error al cargar datos financieros');
    } finally {
      setLoading(false);
      cargandoRef.current = false;
    }
  }, [empresaSeleccionada, datosFinancieros.timestamp]);
  
  // 🔄 FUNCIÓN: Recargar datos (con debounce)
  const recargarDatos = useCallback((delay = 300) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      if (obraActual) {
        
        cargarDatosObra(obraActual, true);
      }
    }, delay);
  }, [obraActual, cargarDatosObra]);
  
  // 🗑️ FUNCIÓN: Limpiar datos
  const limpiarDatos = useCallback(() => {
    
    setObraActual(null);
    setDatosFinancieros({
      presupuesto: null,
      estadisticas: {
        totalPresupuesto: 0,
        totalCobrado: 0,
        totalPagado: 0,
        saldoDisponible: 0,
        porcentajeCobrado: 0,
        porcentajePagado: 0,
        porcentajeDisponible: 0,
        alertas: []
      },
      cobros: [],
      pagos: [],
      pagosConsolidados: [],
      profesionales: [],
      materiales: [],
      otrosCostos: [],
      cajaChica: null,
      timestamp: 0
    });
  }, []);
  
  // 🚌 ESCUCHAR EVENTOS FINANCIEROS
  useEffect(() => {
    if (!obraActual) return;
    
    
    
    const handleFinancialEvent = (eventData) => {
      
      recargarDatos();
    };
    
    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.CAJA_CHICA_ASIGNADA, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.CAJA_CHICA_ACTUALIZADA, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.GASTO_CAJA_CHICA_REGISTRADO, handleFinancialEvent),
    ];
    
    return () => {
      
      unsubscribers.forEach(unsub => unsub());
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [obraActual, recargarDatos]);
  
  // 📦 VALOR DEL CONTEXTO
  const value = {
    // Estado
    obraActual,
    datosFinancieros,
    loading,
    error,
    
    // Acciones
    cargarDatosObra,
    recargarDatos,
    limpiarDatos,
    
    // Helpers
    isDataFresh: () => (Date.now() - datosFinancieros.timestamp) < 5000,
    getEstadisticas: () => datosFinancieros.estadisticas,
    getCobros: () => datosFinancieros.cobros,
    getPagos: () => datosFinancieros.pagos,
    getProfesionales: () => datosFinancieros.profesionales,
    getMateriales: () => datosFinancieros.materiales,
    getOtrosCostos: () => datosFinancieros.otrosCostos,
  };
  
  return (
    <FinancialDataContext.Provider value={value}>
      {children}
    </FinancialDataContext.Provider>
  );
};

// 🧮 FUNCIONES AUXILIARES

const calcularTotalPresupuesto = (presupuesto) => {
  // 🎯 PRIORIDAD 1: Usar totalFinal que incluye TODO (items + honorarios + mayores costos)
  // Este campo ya tiene el cálculo completo del presupuesto con todos los conceptos aplicados
  if (presupuesto.totalFinal && presupuesto.totalFinal > 0) {
    console.log('💰 [FinancialContext] Usando totalFinal (incluye items + honorarios + mayores costos):', presupuesto.totalFinal.toLocaleString('es-AR'));
    return parseFloat(presupuesto.totalFinal);
  }
  
  // FALLBACK 2: totalPresupuestoConHonorarios (similar a totalFinal)
  if (presupuesto.totalPresupuestoConHonorarios && presupuesto.totalPresupuestoConHonorarios > 0) {
    console.log('💰 [FinancialContext] Usando totalPresupuestoConHonorarios:', presupuesto.totalPresupuestoConHonorarios.toLocaleString('es-AR'));
    return parseFloat(presupuesto.totalPresupuestoConHonorarios);
  }
  
  // FALLBACK 3: montoTotal
  if (presupuesto.montoTotal && presupuesto.montoTotal > 0) {
    console.log('💰 [FinancialContext] Usando montoTotal:', presupuesto.montoTotal.toLocaleString('es-AR'));
    return parseFloat(presupuesto.montoTotal);
  }
  
  // FALLBACK 4: totalGeneral
  if (presupuesto.totalGeneral && presupuesto.totalGeneral > 0) {
    console.log('💰 [FinancialContext] Usando totalGeneral:', presupuesto.totalGeneral.toLocaleString('es-AR'));
    return parseFloat(presupuesto.totalGeneral);
  }
  
  // FALLBACK 5: Calcular manualmente desde itemsCalculadora con honorarios y mayores costos
  console.log('💰 [FinancialContext] Calculando manualmente desde itemsCalculadora');
  let totalBase = 0;
  const itemsCalculadora = presupuesto.itemsCalculadora || [];
  
  itemsCalculadora.forEach(item => {
    let subtotalItem = 0;
    
    // Sumar jornales/profesionales
    if (item.profesionales && Array.isArray(item.profesionales)) {
      item.profesionales.forEach(prof => {
        subtotalItem += parseFloat(prof.subtotal || prof.importeCalculado || 0);
      });
    }
    
    // Sumar materiales
    if (item.materialesLista && Array.isArray(item.materialesLista)) {
      item.materialesLista.forEach(mat => {
        subtotalItem += parseFloat(mat.subtotal || 0);
      });
    }
    
    // Sumar otros costos/gastos generales
    if (item.otrosCostos && Array.isArray(item.otrosCostos)) {
      item.otrosCostos.forEach(costo => {
        subtotalItem += parseFloat(costo.importe || 0);
      });
    }
    
    totalBase += subtotalItem;
  });
  
  // Agregar honorarios y mayores costos si están disponibles
  const totalHonorarios = parseFloat(presupuesto.totalHonorarios || 0);
  const totalMayoresCostos = parseFloat(presupuesto.totalMayoresCostos || 0);
  const totalCalculado = totalBase + totalHonorarios + totalMayoresCostos;
  
  console.log('💰 [FinancialContext] Total calculado:', {
    base: totalBase.toLocaleString('es-AR'),
    honorarios: totalHonorarios.toLocaleString('es-AR'),
    mayoresCostos: totalMayoresCostos.toLocaleString('es-AR'),
    total: totalCalculado.toLocaleString('es-AR')
  });
  
  return totalCalculado;
};

const generarAlertas = (metricas) => {
  const alertas = [];
  const {
    totalPresupuesto,
    totalCobrado,
    totalPagado,
    saldoDisponible,
    porcentajeCobrado,
    porcentajePagado,
    porcentajeDisponible
  } = metricas;

  if (saldoDisponible < 0) {
    alertas.push({
      tipo: 'danger',
      icono: '🚨',
      titulo: 'SALDO NEGATIVO',
      mensaje: `Has gastado $${Math.abs(saldoDisponible).toLocaleString('es-AR', { minimumFractionDigits: 2 })} más de lo cobrado`,
      accion: 'Urgente: Necesitas cobrar más dinero al cliente'
    });
  }

  if (saldoDisponible > 0 && porcentajeDisponible < 10 && totalCobrado > 0) {
    alertas.push({
      tipo: 'warning',
      icono: '⚠️',
      titulo: 'SALDO BAJO',
      mensaje: `Solo queda ${porcentajeDisponible.toFixed(1)}% del dinero cobrado disponible`,
      accion: 'Considera solicitar un nuevo cobro pronto'
    });
  }

  if (porcentajePagado > 80 && porcentajeCobrado < 60) {
    alertas.push({
      tipo: 'warning',
      icono: '💰',
      titulo: 'DESBALANCE COBROS/PAGOS',
      mensaje: `Has pagado ${porcentajePagado.toFixed(1)}% pero solo cobraste ${porcentajeCobrado.toFixed(1)}%`,
      accion: 'Necesitas cobrar más para equilibrar el flujo de caja'
    });
  }

  if (porcentajeCobrado > 100) {
    alertas.push({
      tipo: 'info',
      icono: '📈',
      titulo: 'COBRASTE MÁS DEL PRESUPUESTO',
      mensaje: `Has cobrado ${porcentajeCobrado.toFixed(1)}% del presupuesto original`,
      accion: 'Puede haber mayores costos o modificaciones aprobadas'
    });
  }

  if (porcentajePagado > 100) {
    alertas.push({
      tipo: 'danger',
      icono: '🔴',
      titulo: 'PAGASTE MÁS DEL PRESUPUESTO',
      mensaje: `Has pagado ${porcentajePagado.toFixed(1)}% del presupuesto original`,
      accion: 'Urgente: Revisa los costos adicionales y cobra la diferencia'
    });
  }

  return alertas;
};
