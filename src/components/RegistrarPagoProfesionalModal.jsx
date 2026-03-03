import React, { useState, useEffect } from 'react';
import { formatearMoneda, listarPagosPorProfesional, registrarPago } from '../services/pagosProfesionalObraService';
import { registrarPagosConsolidadosBatch, listarPagosConsolidadosPorPresupuesto } from '../services/pagosConsolidadosService';
import {
  calcularDescuentoEstimado, // ⭐ Solo para estimaciones UI
  listarAdelantosActivos,
  formatearMoneda as formatearMonedaAdelantos
} from '../services/adelantosService';
import { useEmpresa } from '../EmpresaContext';
import { useFinancialData } from '../context/FinancialDataContext';
import api from '../services/api';
import DireccionObraSelector from './DireccionObraSelector';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Modal de gestión financiera por obra individual
 * ✨ Usa el contexto centralizado FinancialDataContext para datos sincronizados
 */

const RegistrarPagoProfesionalModal = ({ show, onHide, onSuccess, obraDireccion, refreshTrigger }) => {
  const { empresaSeleccionada } = useEmpresa();

  // 🏦 USAR DATOS DEL CONTEXTO CENTRALIZADO
  const { datosFinancieros, recargarDatos } = useFinancialData();

  // Estados principales
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(obraDireccion || null);
  const [tipoGasto, setTipoGasto] = useState('PROFESIONALES');
  const [profesionalesSuspendidos, setProfesionalesSuspendidos] = useState(new Set());
  const [materialesSuspendidos, setMaterialesSuspendidos] = useState(new Set());
  const [otrosCostosSuspendidos, setOtrosCostosSuspendidos] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(null); // Para materiales y gastos generales
  const [profesionalesExpandidos, setProfesionalesExpandidos] = useState(new Set()); // 🔥 Estado para controlar expansión

  // 📊 OBTENER DATOS DEL CONTEXTO (ya cargados y sincronizados)
  const profesionales = datosFinancieros.profesionales || [];
  const materiales = datosFinancieros.materiales || [];
  const otrosCostos = datosFinancieros.otrosCostos || [];
  const configuracionObra = datosFinancieros.configuracionObra;
  const cargandoDatos = false; // El contexto maneja la carga

  // 📅 Estados para manejar asignaciones semanales
  const [asignacionesGastosSemana, setAsignacionesGastosSemana] = useState([]);
  const [semanasDisponibles, setSemanasDisponibles] = useState([]);

  // 💸 Estados para adelantos activos
  const [adelantosPorProfesional, setAdelantosPorProfesional] = useState({});
  const [loadingAdelantos, setLoadingAdelantos] = useState(false);

  // Auto-actualización cuando el modal se abre O cuando cambia refreshTrigger
  useEffect(() => {
    if (show && empresaSeleccionada) {
      setDireccionSeleccionada(obraDireccion || null);
      setTipoGasto('PROFESIONALES');
      setError(null);
      setProfesionalesSuspendidos(new Set());
      setMaterialesSuspendidos(new Set());
      setOtrosCostosSuspendidos(new Set());
      setSemanaSeleccionada(null);
    }
  }, [show, empresaSeleccionada, obraDireccion, refreshTrigger]);

  // 📅 Cargar configuración y asignaciones cuando cambia la dirección seleccionada O refreshTrigger
  useEffect(() => {
    const obraId = datosFinancieros?.presupuesto?.obraId;
    if (show && empresaSeleccionada && obraId) {
      cargarConfiguracionObra(obraId); // Ahora es async pero no necesitamos await aquí
      cargarAsignacionesSemanales(obraId);
    }
  }, [show, empresaSeleccionada, datosFinancieros?.presupuesto?.obraId, refreshTrigger]);

  // 🔔 Escuchar eventos de pagos para actualizar automáticamente
  useEffect(() => {
    if (!show) return;

    console.log('🔔 [PagoIndividual] Suscribiendo a eventos financieros...');

    // Escuchar pagos individuales (incluso los propios)
    const unsubscribePago = eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, (data) => {
      console.log('🔔 [PagoIndividual] Pago individual detectado, recargando contexto...', data);
      recargarDatos();
    });

    // Escuchar pagos consolidados
    const unsubscribePagoConsolidado = eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, (data) => {
      console.log('🔔 [PagoIndividual] Pago consolidado detectado, recargando contexto...', data);
      recargarDatos();
    });

    // Escuchar actualizaciones generales
    const unsubscribeActualizacion = eventBus.on(FINANCIAL_EVENTS.DATOS_FINANCIEROS_ACTUALIZADOS, (data) => {
      console.log('🔔 [PagoIndividual] Datos financieros actualizados, recargando contexto...', data);
      recargarDatos();
    });

    // Cleanup: desuscribirse al desmontar
    return () => {
      unsubscribePago();
      unsubscribePagoConsolidado();
      unsubscribeActualizacion();
      console.log('🔔 [PagoIndividual] Desuscrito de eventos financieros');
    };
  }, [show, recargarDatos]);

  // 💸 Cargar adelantos activos de todos los profesionales
  useEffect(() => {
    const cargarAdelantosActivos = async () => {
      if (!show || !empresaSeleccionada || profesionales.length === 0) {
        setAdelantosPorProfesional({});
        return;
      }

      setLoadingAdelantos(true);
      const adelantosMap = {};

      try {
        // Cargar adelantos para cada profesional en paralelo
        const promesas = profesionales
          .filter(p => p.profesionalObraId)
          .map(async (prof) => {
            try {
              const adelantos = await listarAdelantosActivos(prof.profesionalObraId, empresaSeleccionada.id);
              if (adelantos && adelantos.length > 0) {
                const totalAdelantos = adelantos.reduce((sum, a) => sum + (a.saldoAdelantoPorDescontar || 0), 0);
                adelantosMap[prof.id] = {
                  cantidad: adelantos.length,
                  total: totalAdelantos,
                  adelantos: adelantos
                };
              }
            } catch (err) {
              console.warn(`⚠️ Error cargando adelantos de ${prof.nombre}:`, err);
            }
          });

        await Promise.all(promesas);
        setAdelantosPorProfesional(adelantosMap);
        console.log('💸 Adelantos cargados:', adelantosMap);
      } catch (err) {
        console.error('❌ Error cargando adelantos:', err);
      } finally {
        setLoadingAdelantos(false);
      }
    };

    cargarAdelantosActivos();
  }, [show, empresaSeleccionada, profesionales, refreshTrigger]);

  // 📅 Cargar configuración de semanas de la obra desde BD
  const cargarConfiguracionObra = async (obraId) => {
    try {
      let numSemanas = 0;

      // PRIORIDAD 1: Obtener desde las asignaciones de BD (tabla: asignacion_semanal_profesional)
      try {
        const { obtenerAsignacionesSemanalPorObra } = await import('../services/profesionalesObraService');
        const asignacionesResponse = await obtenerAsignacionesSemanalPorObra(obraId, empresaSeleccionada.id);
        const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : asignacionesResponse?.data || [];

        // Extraer semanas_objetivo de la primera asignación
        if (asignaciones.length > 0 && asignaciones[0].semanasObjetivo) {
          numSemanas = parseInt(asignaciones[0].semanasObjetivo);
          console.log(`✅ [Pago Modal] Semanas objetivo desde BD: ${numSemanas}`);
        }
      } catch (err) {
        console.warn('⚠️ [Pago Modal] No se pudo obtener semanas desde BD:', err);
      }

      // FALLBACK 2: localStorage solo si no hay en BD (configuración legacy)
      if (numSemanas === 0) {
        const configGuardada = localStorage.getItem(`configuracionObra_${obraId}`);
        if (configGuardada) {
          const config = JSON.parse(configGuardada);
          numSemanas = config.semanasObjetivo || 0;
          console.log(`⚠️ [Pago Modal] Semanas objetivo desde localStorage (legacy): ${numSemanas}`);
        }
      }

      // Generar array de semanas
      if (numSemanas > 0) {
        const semanas = Array.from({length: numSemanas}, (_, i) => i + 1);
        setSemanasDisponibles(semanas);
        console.log(`✅ [Pago Modal] Semanas disponibles configuradas: [${semanas.join(', ')}]`);
      } else {
        setSemanasDisponibles([]);
        console.warn('⚠️ [Pago Modal] No se encontró configuración de semanas');
      }
    } catch (err) {
      console.error('❌ [Pago Modal] Error cargando configuración:', err);
      setSemanasDisponibles([]);
    }
  };

  // 📅 Cargar asignaciones semanales de gastos generales desde BD
  const cargarAsignacionesSemanales = async (obraId) => {
    try {
      // Gastos generales desde el backend (BD tabla: obra_otro_costo)
      const responseGastos = await fetch(
        `http://localhost:8080/api/obras/${obraId}/otros-costos`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );

      if (responseGastos.ok) {
        const gastosAsignados = await responseGastos.json();
        console.log('✅ [Pago Modal] Gastos generales cargados desde BD:', gastosAsignados);
        setAsignacionesGastosSemana(Array.isArray(gastosAsignados) ? gastosAsignados : []);
      } else {
        console.warn('⚠️ [Pago Modal] No se pudieron cargar gastos generales');
        setAsignacionesGastosSemana([]);
      }
    } catch (err) {
      console.error('❌ [Pago Modal] Error cargando asignaciones semanales:', err);
      setAsignacionesGastosSemana([]);
    }
  };

  // Helper para determinar categoría de material por su nombre
  const determinarCategoriaMaterial = (nombre) => {
    if (!nombre) return 'Otros';
    const nombreLower = nombre.toLowerCase();

    if (nombreLower.includes('cable') || nombreLower.includes('electricidad') || nombreLower.includes('luz')) return 'Electricidad';
    if (nombreLower.includes('caño') || nombreLower.includes('plomeria') || nombreLower.includes('cañería')) return 'Plomería';
    if (nombreLower.includes('pintura') || nombreLower.includes('latex') || nombreLower.includes('esmalte')) return 'Pintura';
    if (nombreLower.includes('cemento') || nombreLower.includes('arena') || nombreLower.includes('ladrillos')) return 'Albañilería';
    if (nombreLower.includes('madera') || nombreLower.includes('tablero') || nombreLower.includes('mdf')) return 'Carpintería';
    if (nombreLower.includes('cerámica') || nombreLower.includes('porcelanato') || nombreLower.includes('azulejo')) return 'Revestimientos';

    return 'Materiales Varios';
  };

  // Funciones de suspender/reactivar
  const toggleSuspenderProfesional = (profesionalId) => {
    setProfesionalesSuspendidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(profesionalId)) {
        newSet.delete(profesionalId);
      } else {
        newSet.add(profesionalId);
      }
      return newSet;
    });
  };

  const toggleSuspenderMaterial = (materialId) => {
    setMaterialesSuspendidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const toggleSuspenderOtroCosto = (costoId) => {
    setOtrosCostosSuspendidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(costoId)) {
        newSet.delete(costoId);
      } else {
        newSet.add(costoId);
      }
      return newSet;
    });
  };

  // Pagar a todos los profesionales con saldo
  const pagarTodosProfesionales = async () => {
    // Evitar doble clic
    if (loading) {
      console.warn('⚠️ Ya hay un pago en proceso, ignorando clic duplicado');
      return;
    }

    const profesionalesParaPagar = profesionalesFiltrados.filter(p => p.saldo > 0 && !profesionalesSuspendidos.has(p.id));

    if (profesionalesParaPagar.length === 0) {
      alert('No hay profesionales con saldo pendiente');
      return;
    }

    const total = profesionalesParaPagar.reduce((sum, p) => sum + p.saldo, 0);
    if (!window.confirm(`¿Confirmar pago a ${profesionalesParaPagar.length} profesional(es) por un total de ${formatearMoneda(total)}?${profesionalesSuspendidos.size > 0 ? `\n\n⚠️ ${profesionalesSuspendidos.size} profesional(es) suspendido(s) no será(n) pagado(s)` : ''}`)) {
      return;
    }

    setLoading(true);
    try {
      // Registrar pagos individuales para cada profesional
      for (const prof of profesionalesParaPagar) {
        // Validar que profesionalObraId existe
        if (!prof.profesionalObraId) {
          console.error('❌ Profesional sin profesionalObraId:', prof);
          alert(`Error: El profesional ${prof.nombre} no tiene ID de asignación a obra válido. No se puede registrar el pago.`);
          continue; // Saltar este profesional
        }

        // 🎯 Preparar datos para el backend
        // ⚠️ Backend aplica descuento de adelantos AUTOMÁTICAMENTE
        // Solo enviamos montoBruto, el backend retorna montoFinal con descuentos
        const pagoData = {
          profesionalObraId: prof.profesionalObraId,
          empresaId: empresaSeleccionada.id,
          tipoPago: semanaSeleccionada ? 'SEMANAL' : 'PAGO_TOTAL',
          montoBruto: prof.saldo,
          diasTrabajados: prof.diasTrabajados || 0,
          diasEsperados: prof.diasEsperados || 0,
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          observaciones: semanaSeleccionada
            ? `[PAGO SEMANA ${semanaSeleccionada}] ${prof.nombre} - ${prof.cantidadJornales} jornales`
            : `[PAGO TOTAL] ${prof.nombre} - Total: ${formatearMoneda(prof.saldo)}`
        };

        console.log('📤 JSON ENVIADO AL BACKEND:', JSON.stringify(pagoData, null, 2));

        // 🚀 Enviar al backend - Backend aplica descuentos automáticamente
        const pagoCreado = await registrarPago(pagoData, empresaSeleccionada.id);

        console.log('✅ PAGO CREADO (con descuentos automáticos):', {
          montoBruto: pagoCreado.montoBruto,
          descuentoAdelantos: pagoCreado.descuentoAdelantos || 0,
          montoFinal: pagoCreado.montoFinal,
          adelantosAplicados: pagoCreado.adelantosAplicadosIds
        });
      }

      alert(`✅ ${profesionalesParaPagar.length} profesional(es) pagado(s) exitosamente`);

      // No necesario: EventBus ya notificó al contexto para recargar

      if (onSuccess) onSuccess({ mensaje: `${profesionalesParaPagar.length} profesional(es) pagado(s) exitosamente` });

    } catch (err) {
      console.error('Error al pagar profesionales:', err);
      const errorMsg = err.response?.data?.message ||
                       err.response?.data?.mensaje ||
                       err.message ||
                       'Error desconocido al registrar pagos';

      const errorDetails = err.response ?
        `\nCódigo: ${err.response.status}\nDetalles: ${JSON.stringify(err.response.data)}` :
        '\n\n⚠️ Verifique que el backend esté corriendo correctamente en http://localhost:8080';

      alert(`❌ Error al registrar pagos: ${errorMsg}${errorDetails}`);
    } finally {
      setLoading(false);
    }
  };

  // Pagar profesionales por semana específica
  const pagarProfesionalesSemana = async (numeroSemana) => {
    // Evitar doble clic
    if (loading) {
      console.warn('⚠️ Ya hay un pago en proceso, ignorando clic duplicado');
      return;
    }

    if (!numeroSemana || !configuracionObra) {
      alert('No se pudo determinar la semana a pagar');
      return;
    }

    // Filtrar profesionales que trabajaron en esta semana
    const profesionalesEnSemana = profesionales.filter(prof => {
      if (profesionalesSuspendidos.has(prof.id)) return false;
      if (!prof.semanas || prof.semanas.length === 0) return false;

      // Verificar si el profesional trabajó en esta semana
      const semana = prof.semanas.find(s => s.numeroSemana === parseInt(numeroSemana));
      return semana && semana.diasTrabajados > 0 && (semana.montoSemana - (semana.montoPagado || 0)) > 0;
    });

    if (profesionalesEnSemana.length === 0) {
      alert(`No hay profesionales con saldo pendiente en la semana ${numeroSemana}`);
      return;
    }

    // Calcular el total a pagar
    const totalPagar = profesionalesEnSemana.reduce((sum, prof) => {
      const semana = prof.semanas.find(s => s.numeroSemana === parseInt(numeroSemana));
      return sum + (semana.montoSemana - (semana.montoPagado || 0));
    }, 0);

    if (!window.confirm(`¿Pagar a ${profesionalesEnSemana.length} profesional(es) de la semana ${numeroSemana} por un total de ${formatearMoneda(totalPagar)}?`)) {
      return;
    }

    setLoading(true);
    try {
      // Registrar pagos individuales para cada profesional
      for (const prof of profesionalesEnSemana) {
        const semana = prof.semanas.find(s => s.numeroSemana === parseInt(numeroSemana));
        const montoPagar = semana.montoSemana - (semana.montoPagado || 0);

        const pagoData = {
          profesionalObraId: prof.profesionalObraId,
          empresaId: empresaSeleccionada.id,
          tipoPago: 'PAGO_SEMANAL',
          montoBruto: montoPagar,
          montoFinal: montoPagar,
          montoNeto: montoPagar,
          montoBase: montoPagar,
          descuentoAdelantos: 0,
          descuentoPresentismo: 0,
          porcentajePresentismo: 100,
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          estado: 'PAGADO',
          observaciones: `[PAGO SEMANA ${numeroSemana}] ${prof.nombre} - ${semana.diasTrabajados} días (${semana.fechaInicio} a ${semana.fechaFin})`
        };

        await registrarPago(pagoData, empresaSeleccionada.id);
      }

      alert(`✅ ${profesionalesEnSemana.length} profesional(es) de la semana ${numeroSemana} pagado(s) exitosamente`);

      if (onSuccess) onSuccess();

    } catch (err) {
      console.error('Error al pagar profesionales de la semana:', err);
      const errorMsg = err.response?.data?.message ||
                       err.response?.data?.mensaje ||
                       err.message ||
                       'Error desconocido al registrar pagos';

      const errorDetails = err.response ?
        `\nCódigo: ${err.response.status}\nDetalles: ${JSON.stringify(err.response.data)}` :
        '\n\n⚠️ Verifique que el backend esté corriendo correctamente.';

      alert(`❌ Error al registrar pagos: ${errorMsg}${errorDetails}`);
    } finally {
      setLoading(false);
    }
  };

  // Pagar materiales
  const pagarMateriales = async (soloSemana = false) => {
    // Usar materiales ya filtrados por semana
    const materialesParaPagar = materialesFiltradosPorSemana.filter(m => !m.pagado && !materialesSuspendidos.has(m.id));

    if (materialesParaPagar.length === 0) {
      alert('No hay materiales para pagar en esta semana (todos están pagados o suspendidos)');
      return;
    }

    // Calcular total descontando lo ya pagado
    const totalAPagar = materialesParaPagar.reduce((sum, m) => sum + (m.saldoPendiente || m.precioTotal || 0), 0);
    const totalBruto = materialesParaPagar.reduce((sum, m) => sum + (m.precioTotal || 0), 0);
    const totalYaPagado = materialesParaPagar.reduce((sum, m) => sum + (m.totalPagado || 0), 0);

    const mensaje = semanaSeleccionada ? `Semana ${semanaSeleccionada}` : 'todos los materiales';
    const confirmMsg = semanaSeleccionada
      ? `¿Confirmar pago de materiales de la ${mensaje}?\n\nTotal: ${formatearMoneda(totalAPagar)}${totalYaPagado > 0 ? `\n(Ya pagado: ${formatearMoneda(totalYaPagado)})` : ''}`
      : `¿Confirmar pago TOTAL de ${materialesParaPagar.length} material(es)?\n\nTotal a pagar: ${formatearMoneda(totalAPagar)}${totalYaPagado > 0 ? `\n(Ya pagado: ${formatearMoneda(totalYaPagado)})` : ''}`;

    if (!window.confirm(confirmMsg + (materialesSuspendidos.size > 0 ? `\n\n⚠️ ${materialesSuspendidos.size} material(es) suspendido(s) no será(n) pagado(s)` : ''))) {
      return;
    }

    setLoading(true);
    try {
      const pagosData = materialesParaPagar.map(mat => {
        const montoAPagar = mat.saldoPendiente || mat.precioTotal;
        const cantidadPendiente = mat.totalPagado > 0
          ? ((mat.precioTotal - mat.totalPagado) / mat.precioUnidad)
          : mat.cantidadUnidades;

        return {
          presupuestoNoClienteId: direccionSeleccionada.presupuestoNoClienteId,
          itemCalculadoraId: mat.itemCalculadoraId,
          materialCalculadoraId: mat.materialCalculadoraId,
          empresaId: empresaSeleccionada.id,
          tipoPago: 'MATERIALES',
          concepto: mat.nombre,
          cantidad: parseFloat(cantidadPendiente),
          precioUnitario: parseFloat(mat.precioUnidad),
          monto: parseFloat(montoAPagar),
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          estado: 'PAGADO',
          observaciones: `${semanaSeleccionada ? `[SEMANA ${semanaSeleccionada}] ` : ''}Pago de material - ${mat.nombre} - Obra: ${mat.nombreObra}${mat.totalPagado > 0 ? ` (Saldo pendiente)` : ''}`
        };
      });

      const result = await registrarPagosConsolidadosBatch(pagosData, empresaSeleccionada.id);

      eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
        presupuestoId: direccionSeleccionada.presupuestoNoClienteId,
        tipo: 'MATERIALES',
        cantidad: materialesParaPagar.length
      });

      alert(`✅ ${materialesParaPagar.length} material(es) pagado(s) exitosamente`);

      // Recargar datos del contexto para reflejar los pagos
      await recargarDatos();

      if (onSuccess) onSuccess(result);
    } catch (err) {
      console.error('Error al pagar materiales:', err);
      alert(`❌ Error al registrar pagos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Pagar otros costos
  const pagarOtrosCostos = async (soloSemana = false) => {
    // Usar otros costos ya filtrados por semana, excluyendo los ya pagados
    const costosParaPagar = otrosCostosFiltradosPorSemana.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id));

    if (costosParaPagar.length === 0) {
      alert('No hay otros costos para pagar en esta semana (todos están pagados o suspendidos)');
      return;
    }

    // Calcular total descontando lo ya pagado
    const totalAPagar = costosParaPagar.reduce((sum, c) => sum + (c.saldoPendiente || c.precioTotal || 0), 0);
    const totalBruto = costosParaPagar.reduce((sum, c) => sum + (c.precioTotal || 0), 0);
    const totalYaPagado = costosParaPagar.reduce((sum, c) => sum + (c.totalPagado || 0), 0);

    const mensaje = semanaSeleccionada ? `Semana ${semanaSeleccionada}` : 'todos los gastos';
    const confirmMsg = semanaSeleccionada
      ? `¿Confirmar pago de gastos generales de la ${mensaje}?\n\nTotal: ${formatearMoneda(totalAPagar)}${totalYaPagado > 0 ? `\n(Ya pagado: ${formatearMoneda(totalYaPagado)})` : ''}`
      : `¿Confirmar pago TOTAL de ${costosParaPagar.length} gasto(s)?\n\nTotal a pagar: ${formatearMoneda(totalAPagar)}${totalYaPagado > 0 ? `\n(Ya pagado: ${formatearMoneda(totalYaPagado)})` : ''}`;

    if (!window.confirm(confirmMsg + (otrosCostosSuspendidos.size > 0 ? `\n\n⚠️ ${otrosCostosSuspendidos.size} costo(s) suspendido(s) no será(n) pagado(s)` : ''))) {
      return;
    }

    setLoading(true);
    try {
      const pagosData = costosParaPagar.map(costo => {
        const montoAPagar = costo.saldoPendiente || costo.precioTotal;

        return {
          presupuestoNoClienteId: direccionSeleccionada.presupuestoNoClienteId,
          itemCalculadoraId: costo.itemCalculadoraId,
          materialCalculadoraId: null,
          gastoGeneralCalculadoraId: costo.itemCalculadoraId, // 🔥 Campo obligatorio para backend
          gastoGeneralId: costo.itemCalculadoraId, // 🔥 Recomendado por backend
          empresaId: empresaSeleccionada.id,
          tipoPago: 'GASTOS_GENERALES',
          concepto: costo.nombre,
          cantidad: 1,
          precioUnitario: parseFloat(montoAPagar),
          monto: parseFloat(montoAPagar),
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          estado: 'PAGADO',
          observaciones: `Pago de gastos generales - ${costo.tipo} - Obra: ${costo.nombreObra}${semanaSeleccionada ? ` [SEMANA ${semanaSeleccionada}]` : ''}${costo.totalPagado > 0 ? ` (Saldo pendiente)` : ''}`
        };
      });

      const result = await registrarPagosConsolidadosBatch(pagosData, empresaSeleccionada.id);

      eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
        presupuestoId: direccionSeleccionada.presupuestoNoClienteId,
        tipo: 'GASTOS_GENERALES',
        cantidad: costosParaPagar.length
      });

      alert(`✅ ${costosParaPagar.length} otro(s) costo(s) pagado(s) exitosamente`);
      await recargarDatos();

      if (onSuccess) onSuccess(result);

    } catch (err) {
      console.error('Error al pagar otros costos:', err);
      alert(`❌ Error al registrar pagos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar profesionales según semana seleccionada
  const profesionalesFiltrados = React.useMemo(() => {
    if (!semanaSeleccionada) {
      return profesionales; // Mostrar todos si no hay semana seleccionada
    }

    // Filtrar y transformar profesionales para la semana seleccionada
    return profesionales
      .map(prof => {
        if (!prof.semanas || prof.semanas.length === 0) return null;

        // Buscar datos de la semana seleccionada
        const semana = prof.semanas.find(s => s.numeroSemana === parseInt(semanaSeleccionada));
        if (!semana || semana.diasTrabajados === 0) return null;

        // Crear versión filtrada del profesional solo con datos de esta semana
        return {
          ...prof,
          cantidadJornales: semana.diasTrabajados,
          precioTotal: semana.montoSemana,
          totalPagado: semana.montoPagado || 0,
          saldo: semana.montoSemana - (semana.montoPagado || 0),
          saldoPendiente: semana.montoSemana - (semana.montoPagado || 0)
        };
      })
      .filter(prof => prof !== null); // Remover nulls
  }, [profesionales, semanaSeleccionada]);

  // Filtrar materiales según semana seleccionada
  const materialesFiltradosPorSemana = React.useMemo(() => {
    if (!semanaSeleccionada) {
      // PAGAR TOTAL: mostrar materiales con cantidades ajustadas (descontando pagos de semanas)
      return materiales.map(m => {
        // Si ya está completamente pagado, no mostrarlo
        if (m.pagado) {
          return null;
        }

        return {
          ...m,
          // Usar saldoPendiente calculado por el contexto
          precioTotal: m.saldoPendiente || m.precioTotal,
          cantidadUnidades: m.saldoPendiente > 0 ? (m.saldoPendiente / m.precioUnidad) : m.cantidadUnidades
        };
      }).filter(m => m !== null && m.saldoPendiente > 0);
    }

    return materiales.filter(m => {
      // Excluir materiales ya pagados en esta semana específica
      if (m.semanasPagadas && m.semanasPagadas.has(parseInt(semanaSeleccionada))) {
        return false;
      }

      if (!m.asignaciones || m.asignaciones.length === 0) {
        return false;
      }
      return m.asignaciones.some(asig =>
        asig.semana && parseInt(asig.semana) === parseInt(semanaSeleccionada)
      );
    }).map(m => {
      // 🔥 Encontrar la asignación de esta semana para usar su cantidad/precio
      const asignacionSemana = m.asignaciones.find(asig =>
        asig.semana && parseInt(asig.semana) === parseInt(semanaSeleccionada)
      );

      const precioTotalSemana = asignacionSemana?.cantidad
        ? (asignacionSemana.cantidad * m.precioUnidad)
        : m.precioTotal;

      // Recalcular estado de pago basándose SOLO en la semana seleccionada
      const pagadoCompletamenteEnSemana = m.totalPagado >= precioTotalSemana;
      const pagosParcialeSemana = m.totalPagado > 0 && m.totalPagado < precioTotalSemana;
      const saldoPendienteSemana = precioTotalSemana - m.totalPagado;

      return {
        ...m,
        cantidadUnidades: asignacionSemana?.cantidad || m.cantidadUnidades,
        precioTotal: precioTotalSemana,
        pagado: pagadoCompletamenteEnSemana,
        pagosParciales: pagosParcialeSemana,
        saldoPendiente: saldoPendienteSemana
      };
    });
  }, [materiales, semanaSeleccionada]);

  // Filtrar otros costos según semana seleccionada
  const otrosCostosFiltradosPorSemana = React.useMemo(() => {
    if (!semanaSeleccionada) {
      // PAGAR TOTAL: mostrar costos con montos ajustados (descontando pagos de semanas)
      return otrosCostos.map(c => {
        // Si ya está completamente pagado, no mostrarlo
        if (c.pagado) {
          return null;
        }

        return {
          ...c,
          // Usar saldoPendiente calculado por el contexto
          precioTotal: c.saldoPendiente || c.precioTotal
        };
      }).filter(c => c !== null && c.saldoPendiente > 0);
    }

    return otrosCostos.filter(c => {
      // Excluir costos ya pagados en esta semana específica
      if (c.semanasPagadas && c.semanasPagadas.has(parseInt(semanaSeleccionada))) {
        return false;
      }

      if (!c.asignaciones || c.asignaciones.length === 0) {
        return false;
      }
      return c.asignaciones.some(asig =>
        asig.semana && parseInt(asig.semana) === parseInt(semanaSeleccionada)
      );
    }).map(c => {
      // 🔥 Encontrar la asignación de esta semana para usar su importe
      const asignacionSemana = c.asignaciones.find(asig =>
        asig.semana && parseInt(asig.semana) === parseInt(semanaSeleccionada)
      );

      const precioTotalSemana = asignacionSemana?.importe || c.precioTotal;

      // Recalcular estado de pago basándose SOLO en la semana seleccionada
      const pagadoCompletamenteEnSemana = c.totalPagado >= precioTotalSemana;
      const pagosParcialeSemana = c.totalPagado > 0 && c.totalPagado < precioTotalSemana;
      const saldoPendienteSemana = precioTotalSemana - c.totalPagado;

      return {
        ...c,
        precioTotal: precioTotalSemana,
        cantidadAsignada: asignacionSemana?.cantidad || c.cantidad,
        pagado: pagadoCompletamenteEnSemana,
        pagosParciales: pagosParcialeSemana,
        saldoPendiente: saldoPendienteSemana
      };
    });
  }, [otrosCostos, semanaSeleccionada]);

  // Contadores
  const materialesPagados = materialesFiltradosPorSemana.filter(m => m.pagado).length;
  const otrosCostosPagados = otrosCostosFiltradosPorSemana.filter(c => c.pagado).length;
  const profesionalesPagados = profesionalesFiltrados.filter(p => p.saldo <= 0).length;
  const profesionalesConSaldo = profesionalesFiltrados.filter(p => p.saldo > 0 && !profesionalesSuspendidos.has(p.id)).length;

  if (!show) return null;

  return (
    <div className={`modal fade ${show ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              Pagos - Obra Seleccionada
            </h5>
            <button
              type="button"
              className="btn btn-light btn-sm ms-auto"
              onClick={onHide}
              disabled={loading}
            >
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            {/* Selector de dirección */}
            {!obraDireccion && (
              <div className="mb-3">
                <label className="form-label fw-bold">Seleccionar Obra</label>
                <DireccionObraSelector
                  value={direccionSeleccionada}
                  onChange={(dir) => {
                    setDireccionSeleccionada(dir);
                    // El cambio de obra se maneja en SistemaFinancieroPage
                  }}
                  empresaId={empresaSeleccionada?.id}
                />
              </div>
            )}

            {direccionSeleccionada && (
              <>
                {/* Mensajes de error */}
                {error && (
                  <div className="alert alert-warning">
                    <pre className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
                  </div>
                )}

                {/* Botones de navegación - MISMO ESTILO QUE CONSOLIDADO */}
                <div className="mb-3">
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn btn-lg ${tipoGasto === 'PROFESIONALES' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTipoGasto('PROFESIONALES')}
                      disabled={cargandoDatos}
                    >
                      👷 Profesionales ({profesionales.length})
                      {profesionalesPagados > 0 && (
                        <span className="badge bg-success ms-2">✅ {profesionalesPagados} pagado(s)</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-lg ${tipoGasto === 'MATERIALES' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setTipoGasto('MATERIALES')}
                      disabled={cargandoDatos}
                    >
                      🧱 Materiales ({materialesFiltradosPorSemana.length})
                      {materialesPagados > 0 && (
                        <span className="badge bg-success ms-2">✅ {materialesPagados} pagado(s)</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-lg ${tipoGasto === 'OTROS_COSTOS' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => setTipoGasto('OTROS_COSTOS')}
                      disabled={cargandoDatos}
                    >
                      📋 Otros Costos ({otrosCostosFiltradosPorSemana.length})
                      {otrosCostosPagados > 0 && (
                        <span className="badge bg-success ms-2">✅ {otrosCostosPagados} pagado(s)</span>
                      )}
                    </button>
                  </div>
                </div>

                {cargandoDatos ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p className="mt-2">Cargando datos financieros...</p>
                  </div>
                ) : (
                  <>
                    {/* PROFESIONALES */}
                    {tipoGasto === 'PROFESIONALES' && (
                      <>
                        {/* Selector de Semana */}
                        <div className="mb-3">
                          <label className="form-label fw-bold">Seleccionar Semana (Opcional)</label>
                          <select
                            className="form-select"
                            value={semanaSeleccionada || ''}
                            onChange={(e) => setSemanaSeleccionada(e.target.value || null)}
                          >
                            <option value="">-- Todas las Semanas (Pagar Total) --</option>
                            {semanasDisponibles.map(num => (
                              <option key={num} value={num}>Semana {num}</option>
                            ))}
                          </select>
                        </div>

                        {profesionalesConSaldo > 0 && (
                          <div className="mb-3">
                            <div className="row g-2">
                              {/* Botón Pagar Total */}
                              <div className="col-md-6">
                                <button
                                  className="btn btn-success btn-lg w-100"
                                  onClick={pagarTodosProfesionales}
                                  disabled={loading || cargandoDatos}
                                >
                                  {loading ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm me-2"></span>
                                      Procesando...
                                    </>
                                  ) : (
                                    <>
                                      💸 Pagar {semanaSeleccionada ? `Semana ${semanaSeleccionada}` : 'TOTAL Profesionales'}
                                      <span className="ms-2 d-block small">
                                        ({profesionalesConSaldo} prof. - Total: {formatearMoneda(
                                          profesionalesFiltrados
                                            .filter(p => p.saldo > 0 && !profesionalesSuspendidos.has(p.id))
                                            .reduce((sum, p) => sum + p.saldo, 0)
                                        )})
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                            {profesionalesSuspendidos.size > 0 && (
                              <div className="alert alert-warning mt-2 py-2 mb-0">
                                <small>⚠️ {profesionalesSuspendidos.size} profesional(es) suspendido(s) no será(n) pagado(s)</small>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="table-responsive">
                          <table className="table table-hover table-bordered">
                            {/* ENCABEZADOS ACTUALIZADOS - v3.0 FORZADO */}
                            <thead style={{
                              backgroundColor: '#212529',
                              color: 'white',
                              position: 'sticky',
                              top: 0,
                              zIndex: 100,
                              display: 'table-header-group',
                              visibility: 'visible'
                            }}>
                              <tr style={{backgroundColor: '#212529', color: 'white'}}>
                                <th style={{minWidth: '120px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Tipo Profesional</th>
                                <th style={{minWidth: '150px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Nombre Completo</th>
                                <th style={{minWidth: '120px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Fecha probable de inicio</th>
                                <th style={{minWidth: '80px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Días Trabajados</th>
                                <th style={{minWidth: '120px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Tarifa por Día</th>
                                <th style={{minWidth: '120px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Total a Pagar</th>
                                <th style={{minWidth: '120px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Total Pagado</th>
                                <th style={{minWidth: '120px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Saldo Pendiente</th>
                                <th style={{minWidth: '100px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Estado Pago</th>
                                <th style={{minWidth: '100px', backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profesionalesFiltrados.map(prof => {
                                const estaSuspendido = profesionalesSuspendidos.has(prof.id);
                                const estaCompleto = prof.precioTotal > 0 && prof.totalPagado >= prof.precioTotal;
                                // 💸 Obtener adelantos activos de este profesional
                                const adelantosInfo = adelantosPorProfesional[prof.id];
                                const tieneAdelantos = adelantosInfo && adelantosInfo.total > 0;

                                // Buscar fecha probable de inicio
                                let fechaProbable = '';
                                if (prof.fechaProbableInicio) {
                                  fechaProbable = prof.fechaProbableInicio;
                                } else if (prof.semanas && prof.semanas.length > 0 && prof.semanas[0].fechaInicio) {
                                  fechaProbable = prof.semanas[0].fechaInicio;
                                }
                                return (
                                  <tr key={prof.id} className={estaCompleto ? 'table-success' : estaSuspendido ? 'table-secondary' : ''}>
                                    <td>{prof.tipo}</td>
                                    <td>
                                      {prof.nombre}
                                      {estaCompleto && (
                                        <span className="badge bg-success ms-2">✅ PAGADO</span>
                                      )}
                                      {estaSuspendido && !estaCompleto && (
                                        <span className="badge bg-secondary ms-2">Suspendido</span>
                                      )}
                                      {/* 💸 NUEVO: Badge de adelantos activos */}
                                      {tieneAdelantos && !estaCompleto && (
                                        <span
                                          className="badge bg-warning text-dark ms-2"
                                          title={`${adelantosInfo.cantidad} adelanto(s) activo(s)`}
                                        >
                                          💸 Adelanto: {formatearMoneda(adelantosInfo.total)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="text-center">{fechaProbable || <span className="text-muted">—</span>}</td>
                                    <td className="text-center">{prof.cantidadJornales}</td>
                                    <td className="text-end">{formatearMoneda(prof.precioJornal)}</td>
                                    <td className="text-end fw-bold">{formatearMoneda(prof.precioTotal)}</td>
                                    <td className="text-end text-success">{formatearMoneda(prof.totalPagado)}</td>
                                    <td className="text-end text-danger">{formatearMoneda(prof.saldo)}</td>
                                    <td className="text-center">
                                      {estaCompleto ? (
                                        <span className="badge bg-success">✅ Completo</span>
                                      ) : estaSuspendido ? (
                                        <span className="badge bg-secondary">Suspendido</span>
                                      ) : prof.totalPagado > 0 && prof.precioTotal > 0 ? (
                                        <span className="badge bg-warning text-dark">⚠️ Parcial ({((prof.totalPagado / prof.precioTotal) * 100).toFixed(0)}%)</span>
                                      ) : (
                                        <span className="badge bg-secondary">Pendiente</span>
                                      )}
                                    </td>
                                    <td>
                                      {!estaCompleto && (
                                        <button
                                          className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                          onClick={() => toggleSuspenderProfesional(prof.id)}
                                          disabled={loading}
                                        >
                                          {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* MATERIALES */}
                    {tipoGasto === 'MATERIALES' && (
                      <>
                        {/* Selector de Semana */}
                        <div className="mb-3">
                          <label className="form-label fw-bold">Seleccionar Semana (Opcional)</label>
                          <select
                            className="form-select"
                            value={semanaSeleccionada || ''}
                            onChange={(e) => setSemanaSeleccionada(e.target.value || null)}
                          >
                            <option value="">-- Todas las Semanas (Pagar Total) --</option>
                            {semanasDisponibles.map(num => (
                              <option key={num} value={num}>Semana {num}</option>
                            ))}
                          </select>
                        </div>

                        {materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length > 0 && (
                          <div className="mb-3">
                            <div className="row g-2">
                              {/* Botón Pagar Total */}
                              <div className="col-md-6">
                                <button
                                  className="btn btn-success btn-lg w-100"
                                  onClick={() => pagarMateriales(false)}
                                  disabled={loading}
                                >
                                  {loading ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm me-2"></span>
                                      Procesando...
                                    </>
                                  ) : (
                                    <>
                                      💸 Pagar TOTAL Materiales
                                      <span className="ms-2 d-block small">
                                        ({materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length} mat. -
                                        Total: {formatearMoneda(materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).reduce((sum, m) => sum + (m.precioTotal || 0), 0))})
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Botón Pagar Solo Semana */}
                              {semanaSeleccionada && (
                                <div className="col-md-6">
                                  <button
                                    className="btn btn-primary btn-lg w-100"
                                    onClick={() => pagarMateriales(true)}
                                    disabled={loading}
                                  >
                                    {loading ? (
                                      <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Procesando...
                                      </>
                                    ) : (
                                      <>
                                        📅 Pagar Solo Semana {semanaSeleccionada}
                                        <span className="ms-2 d-block small">
                                          (Materiales de esta semana)
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                            {materialesSuspendidos.size > 0 && (
                              <div className="alert alert-warning mt-2 py-2 mb-0">
                                <small>⚠️ {materialesSuspendidos.size} material(es) suspendido(s) no será(n) pagado(s)</small>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="table-responsive">
                          <table className="table table-hover table-bordered">
                            <thead style={{
                              backgroundColor: '#212529',
                              color: 'white',
                              position: 'sticky',
                              top: 0,
                              zIndex: 100,
                              display: 'table-header-group',
                              visibility: 'visible'
                            }}>
                              <tr style={{backgroundColor: '#212529', color: 'white'}}>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Material</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Cantidad</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Unidad</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Precio Unit.</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Total</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {materialesFiltradosPorSemana.map(mat => {
                                const estaSuspendido = materialesSuspendidos.has(mat.id);
                                const estaPagado = mat.pagado;
                                return (
                                  <tr key={mat.id} className={estaSuspendido ? 'table-secondary' : estaPagado ? 'table-success' : mat.pagosParciales ? 'table-warning' : ''}>
                                    <td>
                                      {mat.nombre}
                                      {estaPagado && (
                                        <span className="badge bg-success ms-2">✅ PAGADO</span>
                                      )}
                                      {mat.pagosParciales && !estaPagado && (
                                        <span className="badge bg-warning ms-2">⚠️ PAGO PARCIAL ({formatearMoneda(mat.totalPagado)})</span>
                                      )}
                                      {estaSuspendido && !estaPagado && (
                                        <span className="badge bg-secondary ms-2">Suspendido</span>
                                      )}
                                    </td>
                                    <td className="text-center">{mat.cantidadUnidades}</td>
                                    <td>{mat.unidad}</td>
                                    <td className="text-end">{formatearMoneda(mat.precioUnidad)}</td>
                                    <td className="text-end fw-bold">
                                      {formatearMoneda(mat.precioTotal)}
                                      {mat.pagosParciales && (
                                        <div><small className="text-warning">Pendiente: {formatearMoneda(mat.saldoPendiente)}</small></div>
                                      )}
                                    </td>
                                    <td>
                                      {estaPagado ? (
                                        // Material completamente pagado - mostrar badge verde
                                        <span className="badge bg-success">✅ Completo</span>
                                      ) : mat.pagosParciales && semanaSeleccionada ? (
                                        // Material con pago parcial Y hay semana seleccionada - mostrar badge informativo
                                        <span className="badge bg-warning text-dark">⚠️ Parcial</span>
                                      ) : (
                                        // Material no pagado o pago parcial en modo "Pagar Total" - mostrar botón suspender
                                        <button
                                          className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                          onClick={() => toggleSuspenderMaterial(mat.id)}
                                          disabled={loading}
                                        >
                                          {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <th colSpan="4" className="text-end">TOTAL MATERIALES:</th>
                                <th className="text-end">{formatearMoneda(materialesFiltradosPorSemana.reduce((sum, m) => sum + (m.precioTotal || 0), 0))}</th>
                                <th></th>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}

                    {/* OTROS COSTOS */}
                    {tipoGasto === 'OTROS_COSTOS' && (
                      <>
                        {/* Selector de Semana */}
                        <div className="mb-3">
                          <label className="form-label fw-bold">Seleccionar Semana (Opcional)</label>
                          <select
                            className="form-select"
                            value={semanaSeleccionada || ''}
                            onChange={(e) => setSemanaSeleccionada(e.target.value || null)}
                          >
                            <option value="">-- Todas las Semanas (Pagar Total) --</option>
                            {semanasDisponibles.map(num => (
                              <option key={num} value={num}>Semana {num}</option>
                            ))}
                          </select>
                        </div>

                        {otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length > 0 && (
                          <div className="mb-3">
                            <div className="row g-2">
                              {/* Botón Pagar Total */}
                              <div className="col-md-6">
                                <button
                                  className="btn btn-success btn-lg w-100"
                                  onClick={() => pagarOtrosCostos(false)}
                                  disabled={loading}
                                >
                                  {loading ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm me-2"></span>
                                      Procesando...
                                    </>
                                  ) : (
                                    <>
                                      💸 Pagar TOTAL Gastos Generales
                                      <span className="ms-2 d-block small">
                                        ({otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length} costos -
                                        Total: {formatearMoneda(otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).reduce((sum, c) => sum + (c.precioTotal || 0), 0))})
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Botón Pagar Solo Semana */}
                              {semanaSeleccionada && (
                                <div className="col-md-6">
                                  <button
                                    className="btn btn-primary btn-lg w-100"
                                    onClick={() => pagarOtrosCostos(true)}
                                    disabled={loading}
                                  >
                                    {loading ? (
                                      <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Procesando...
                                      </>
                                    ) : (
                                      <>
                                        📅 Pagar Solo Semana {semanaSeleccionada}
                                        <span className="ms-2 d-block small">
                                          (Gastos de esta semana)
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                            {otrosCostosSuspendidos.size > 0 && (
                              <div className="alert alert-warning mt-2 py-2 mb-0">
                                <small>⚠️ {otrosCostosSuspendidos.size} costo(s) suspendido(s) no será(n) pagado(s)</small>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="table-responsive">
                          <table className="table table-hover table-bordered">
                            <thead style={{
                              backgroundColor: '#212529',
                              color: 'white',
                              position: 'sticky',
                              top: 0,
                              zIndex: 100,
                              display: 'table-header-group',
                              visibility: 'visible'
                            }}>
                              <tr style={{backgroundColor: '#212529', color: 'white'}}>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Tipo</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Descripción</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Total</th>
                                <th style={{backgroundColor: '#212529', color: 'white', padding: '12px', fontWeight: 'bold'}}>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {otrosCostosFiltradosPorSemana.map(costo => {
                                const estaSuspendido = otrosCostosSuspendidos.has(costo.id);
                                const estaPagado = costo.pagado;
                                return (
                                  <tr key={costo.id} className={estaSuspendido ? 'table-secondary' : estaPagado ? 'table-success' : costo.pagosParciales ? 'table-warning' : ''}>
                                    <td>{costo.tipo}</td>
                                    <td>
                                      {costo.nombre}
                                      {estaPagado && (
                                        <span className="badge bg-success ms-2">✅ PAGADO</span>
                                      )}
                                      {costo.pagosParciales && !estaPagado && (
                                        <span className="badge bg-warning ms-2">⚠️ PAGO PARCIAL ({formatearMoneda(costo.totalPagado)})</span>
                                      )}
                                      {estaSuspendido && !estaPagado && (
                                        <span className="badge bg-secondary ms-2">Suspendido</span>
                                      )}
                                    </td>
                                    <td className="text-end fw-bold">
                                      {formatearMoneda(costo.precioTotal)}
                                      {costo.pagosParciales && (
                                        <div><small className="text-warning">Pendiente: {formatearMoneda(costo.saldoPendiente)}</small></div>
                                      )}
                                    </td>
                                    <td>
                                      {estaPagado ? (
                                        // Costo completamente pagado - mostrar badge verde
                                        <span className="badge bg-success">✅ Completo</span>
                                      ) : costo.pagosParciales && semanaSeleccionada ? (
                                        // Costo con pago parcial Y hay semana seleccionada - mostrar badge informativo
                                        <span className="badge bg-warning text-dark">⚠️ Parcial</span>
                                      ) : (
                                        // Costo no pagado o pago parcial en modo "Pagar Total" - mostrar botón suspender
                                        <button
                                          className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                          onClick={() => toggleSuspenderOtroCosto(costo.id)}
                                          disabled={loading}
                                        >
                                          {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <th colSpan="2" className="text-end">TOTAL OTROS COSTOS:</th>
                                <th className="text-end">{formatearMoneda(otrosCostosFiltradosPorSemana.reduce((sum, c) => sum + (c.precioTotal || 0), 0))}</th>
                                <th></th>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="modal-footer bg-light">
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={onHide}
              disabled={loading}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarPagoProfesionalModal;
