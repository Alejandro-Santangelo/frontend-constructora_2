import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Alert, Table, Spinner, Accordion, OverlayTrigger, Popover } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import apiService from '../services/api';

/**
 * Modal para Gestión Consolidada de Pagos a Profesionales
 * Estructura jerárquica: Profesional → Obras → Asignaciones por rubro
 * Muestra todos los profesionales con sus obras y asignaciones consolidadas
 * Última actualización: 15/03/2026 - Corrección pools negativos
 */
const GestionPagosProfesionalesModal = ({
  show,
  onHide,
  onSuccess,
  empresaId // 🔑 Recibir empresaId como prop explícita
}) => {
  const { empresaSeleccionada } = useEmpresa();
  // 🔑 Usar empresaId prop si existe, sino fallback al contexto
  const idEmpresaActual = empresaId || empresaSeleccionada?.id;

  // 🔍 DEBUG: Log cada vez que cambia la empresa en el modal
  useEffect(() => {
    console.log('🔄 [MODAL PAGOS] EmpresaId cambió a:', idEmpresaActual);
    console.log('🔄 [MODAL PAGOS] empresaSeleccionada:', empresaSeleccionada);
  }, [idEmpresaActual, empresaSeleccionada]);

  // Estados principales
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para edición de campos
  const [editando, setEditando] = useState(null); // { asigId, campo }
  const [valorTemporal, setValorTemporal] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [campoAEditar, setCampoAEditar] = useState(null); // { asigId, campo, valorActual }

  // 💰 Estados para pools de dinero por rubro/obra
  const [poolsRubros, setPoolsRubros] = useState({}); // { 'obraId_rubroNombre': { total, asignado, disponible } }
  const [presupuestos, setPresupuestos] = useState([]); // Presupuestos de las obras
  const [editandoPool, setEditandoPool] = useState(null); // { poolKey }
  const [valorTemporalPool, setValorTemporalPool] = useState('');
  const [mostrarConfirmacionPool, setMostrarConfirmacionPool] = useState(false);
  const [poolAEditar, setPoolAEditar] = useState(null); // { poolKey, valorActual }
  
  // 💵 Estados para importes a pagar por asignación
  const [importesPago, setImportesPago] = useState({}); // { asigId: importe }
  const [fechasPago, setFechasPago] = useState({}); // { asigId: fecha }
  const [guardandoPagos, setGuardandoPagos] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Cargar profesionales y presupuestos cuando se abre el modal
  useEffect(() => {
    if (show && idEmpresaActual) {
      cargarProfesionalesConsolidados();
      cargarPresupuestos();
      // 💵 Limpiar importes y fechas de pago al abrir el modal
      setImportesPago({});
      setFechasPago({});
    }
  }, [show, idEmpresaActual]);

  // 💰 Recalcular pools cuando cambien profesionales o presupuestos
  useEffect(() => {
    if (profesionales.length > 0) {
      calcularPoolsIniciales(profesionales);
    }
  }, [profesionales, presupuestos]);

  const cargarProfesionalesConsolidados = async () => {
    if (!idEmpresaActual) {
      console.warn('⚠️ No hay empresa seleccionada');
      return;
    }

    // 🔍 DEBUG: Verificar qué empresaId se está usando
    console.log('🏢 [MODAL PAGOS] Cargando profesionales para empresaId:', idEmpresaActual);
    console.log('🏢 [MODAL PAGOS] empresaSeleccionada del contexto:', empresaSeleccionada);
    console.log('🏢 [MODAL PAGOS] empresaId prop:', empresaId);

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.get(`/api/profesionales-obras/profesionales-consolidados`, {
        params: { empresaId: idEmpresaActual }
      });

      const profesionalesData = Array.isArray(response) ? response : (response?.data || []);
      
      // 🔍 DEBUG: Ver estructura de datos recibidos
      if (profesionalesData.length > 0) {
        console.log('🔍 DEBUG - Estructura de datos recibidos:', {
          totalProfesionales: profesionalesData.length,
          primerProfesional: profesionalesData[0].profesionalNombre,
          primeraObra: profesionalesData[0].obras?.[0]?.obraNombre,
          primeraAsignacion: profesionalesData[0].obras?.[0]?.asignaciones?.[0],
          todosLosCamposDeAsignacion: Object.keys(profesionalesData[0].obras?.[0]?.asignaciones?.[0] || {})
        });
      }
      
      setProfesionales(profesionalesData);
    } catch (err) {
      console.error('❌ Error al cargar profesionales consolidados:', err);
      setError(err.response?.data?.message || 'Error al cargar información de pagos a profesionales');
    } finally {
      setLoading(false);
    }
  };

  // 💰 Cargar presupuestos de las obras
  const cargarPresupuestos = async () => {
    try {
      const response = await apiService.get('/api/presupuestos-no-cliente', {
        empresaId: idEmpresaActual,
        page: 0,
        size: 1000
      });

      const data = response?.data ?? response;
      const lista = Array.isArray(data) ? data : (data?.content || []);
      
      console.log('🔍 Presupuestos cargados:', lista.length);
      if (lista.length > 0) {
        console.log('🔍 Primer presupuesto completo:', lista[0]);
        console.log('🔍 Campos del presupuesto:', Object.keys(lista[0]));
        console.log('🔍 itemsCalculadoraJson:', lista[0].itemsCalculadoraJson);
      }
      
      setPresupuestos(lista);
    } catch (err) {
      console.warn('No se pudieron cargar presupuestos:', err.message);
    }
  };

  // 💰 Calcular pools iniciales de rubros por obra
  const calcularPoolsIniciales = (profesionalesData) => {
    const pools = {};

    profesionalesData.forEach(prof => {
      prof.obras.forEach(obra => {
        obra.asignaciones.forEach(asig => {
          const poolKey = `${obra.obraId}_${asig.rubroNombre}`;

          if (!pools[poolKey]) {
            // 🔑 USAR VALORES DEL BACKEND (ya vienen correctos y compartidos)
            pools[poolKey] = {
              obraId: obra.obraId,
              obraNombre: obra.obraNombre,
              rubroNombre: asig.rubroNombre,
              importeTotal: Number(asig.totalAsignado || 0), // ✅ Usar valor compartido del backend
              importeAsignado: Number(asig.totalAsignado || 0), // ✅ Usar valor compartido del backend
              importePagado: Number(asig.totalPagado || 0), // ✅ Usar valor compartido del backend
              importeDisponible: Number(asig.saldoPendiente || 0) // ✅ Usar valor compartido del backend
            };
          }
          // ⚠️ NO sumar nada más - los valores ya vienen compartidos por (obra, rubro) desde el backend
        });
      });
    });

    // 💰 Intentar cargar totales desde presupuestos
    if (presupuestos && presupuestos.length > 0) {
      console.log('🔍 DEBUG - Cargando presupuestos:', presupuestos.length);
      
      presupuestos.forEach(presupuesto => {
        // Buscar itemsCalculadora (nombre correcto del campo)
        const items = presupuesto.itemsCalculadora || [];
        
        console.log('🔍 Presupuesto obraId:', presupuesto.obraId, 'Items:', items.length);

        items.forEach((item, idx) => {
          const rubroNombre = item.tipoProfesional || item.rubroNombre || 'Sin rubro';
          const obraId = presupuesto.obraId || presupuesto.obra_id;

          if (!obraId) return;

          const poolKey = `${obraId}_${rubroNombre}`;
          
          // 🔍 DEBUG: Ver estructura del item
          if (idx === 0) {
            console.log('🔍 Estructura item[0]:', {
              tipoProfesional: item.tipoProfesional,
              rubroNombre: item.rubroNombre,
              subtotalManoObra: item.subtotalManoObra,
              subtotalJornales: item.subtotalJornales,
              total: item.total,
              camposDisponibles: Object.keys(item)
            });
          }

          if (pools[poolKey]) {
            // Usar subtotalManoObra (nombre correcto del campo en backend)
            const totalJornales = Number(item.subtotalManoObra || 0) ||
                                 Number(item.subtotalJornales || 0) ||
                                 (item.jornales?.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0)) ||
                                 0;

            console.log(`💰 Pool ${poolKey}: agregando ${totalJornales} (total actual: ${pools[poolKey].importeTotal})`);
            pools[poolKey].importeTotal += Number(totalJornales);
          } else {
            console.log(`⚠️ Pool ${poolKey} no encontrado en pools`);
          }
        });
      });
    }

    // 💰 Calcular disponible real (pool compartido: total - ya pagado)
    Object.keys(pools).forEach(key => {
      pools[key].importeDisponible = pools[key].importeTotal - pools[key].importePagado;
      console.log(`💰 Pool ${key}: Total=${pools[key].importeTotal}, Pagado=${pools[key].importePagado}, Disponible=${pools[key].importeDisponible}`);
    });

    setPoolsRubros(pools);
    console.log('Pools iniciales calculados:', pools);
  };

  // 💰 Obtener pool disponible para una obra/rubro
  const obtenerPoolDisponible = (obraId, rubroNombre) => {
    const poolKey = `${obraId}_${rubroNombre}`;
    const pool = poolsRubros[poolKey];

    if (!pool) return { disponible: 0, total: 0, asignado: 0 };

    return {
      disponible: pool.importeDisponible,
      total: pool.importeTotal,
      asignado: pool.importeAsignado
    };
  };

  // 💰 Actualizar pool cuando se asigna dinero a un profesional
  const actualizarPoolAlAsignar = (obraId, rubroNombre, montoAnterior, montoNuevo) => {
    const poolKey = `${obraId}_${rubroNombre}`;

    setPoolsRubros(prev => {
      const pool = prev[poolKey];
      if (!pool) return prev;

      const diferencia = montoNuevo - montoAnterior;
      const nuevoAsignado = pool.importeAsignado + diferencia;
      const nuevoDisponible = pool.importeTotal - nuevoAsignado;

      return {
        ...prev,
        [poolKey]: {
          ...pool,
          importeAsignado: nuevoAsignado,
          importeDisponible: nuevoDisponible
        }
      };
    });
  };

  // 💰 Solicitar edición del total del pool
  const solicitarEdicionPool = (obraId, rubroNombre, valorActual) => {
    const poolKey = `${obraId}_${rubroNombre}`;
    console.log('🔍 Solicitando edición pool:', { poolKey, valorActual });
    setPoolAEditar({ poolKey, valorActual });
    setMostrarConfirmacionPool(true);
  };

  // 💰 Confirmar edición del pool
  const confirmarEdicionPool = () => {
    console.log('✅ Confirmando edición pool:', poolAEditar);
    if (!poolAEditar) {
      console.error('❌ poolAEditar es null');
      return;
    }
    
    // Guardar valores antes de limpiar
    const poolInfo = {
      poolKey: poolAEditar.poolKey,
      valorActual: poolAEditar.valorActual
    };
    
    // Primero: cerrar modal
    setMostrarConfirmacionPool(false);
    setPoolAEditar(null);
    
    // Segundo: después de 150ms, activar input (permite que React complete el render)
    setTimeout(() => {
      console.log('🎯 Activando input para:', poolInfo.poolKey);
      setEditandoPool({ poolKey: poolInfo.poolKey });
      setValorTemporalPool(String(poolInfo.valorActual));
    }, 150);
  };

  // 💰 Cancelar edición del pool
  const cancelarEdicionPool = () => {
    setPoolAEditar(null);
    setMostrarConfirmacionPool(false);
    setEditandoPool(null);
    setValorTemporalPool('');
  };

  // 💰 Guardar cambio del total del pool
  const guardarCambioPool = async (poolKey, nuevoTotal) => {
    // Extraer obraId y rubroNombre del poolKey (formato: "obraId_rubroNombre")
    const [obraIdStr, ...rubroPartes] = poolKey.split('_');
    const obraId = parseInt(obraIdStr);
    const rubroNombre = rubroPartes.join('_'); // Por si el nombre tiene underscores
    
    console.log('💾 Guardando pool:', { poolKey, obraId, rubroNombre, nuevoTotal });
    
    try {
      // Llamar al backend para persistir el cambio
      await apiService.patch('/api/presupuestos-no-cliente/pool-mano-obra', null, {
        params: {
          obraId: obraId,
          tipoProfesional: rubroNombre,
          nuevoSubtotal: nuevoTotal,
          empresaId: idEmpresaActual
        }
      });
      
      // ✅ RECARGAR DATOS COMPLETOS del backend para sincronizar todos los valores
      await cargarProfesionalesConsolidados();
      
      setEditandoPool(null);
      setValorTemporalPool('');
      
      // Mostrar mensaje de éxito
      setMensajeExito(`✅ Pool de ${rubroNombre} actualizado exitosamente`);
      setTimeout(() => setMensajeExito(null), 3000);
      
      console.log('✅ Pool guardado y datos recargados exitosamente');
      
    } catch (err) {
      console.error('❌ Error al guardar pool:', err);
      setError(err.response?.data?.mensaje || err.response?.data?.message || 'Error al actualizar el pool');
      setTimeout(() => setError(null), 5000);
      
      // Restaurar valor anterior en caso de error
      setEditandoPool(null);
      setValorTemporalPool('');
    }
  };

  const formatearMoneda = (valor) => {
    if (!valor && valor !== 0) return '$0.00';
    return `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 💰 Calcular presupuesto base total de un profesional (suma de todos los pools de sus rubros/obras)
  const calcularPresupuestoBaseProfesional = (profesional) => {
    let totalPresupuestoBase = 0;
    
    profesional.obras?.forEach(obra => {
      const rubrosUnicos = [...new Set(obra.asignaciones.map(a => a.rubroNombre))];
      rubrosUnicos.forEach(rubroNombre => {
        const pool = obtenerPoolDisponible(obra.obraId, rubroNombre);
        totalPresupuestoBase += Number(pool.total || 0);
      });
    });
    
    return totalPresupuestoBase;
  };

  // 💰 Calcular saldo pendiente total de un profesional (suma de todos sus saldos pendientes)
  const calcularSaldoPendienteProfesional = (profesional) => {
    let totalSaldoPendiente = 0;
    
    profesional.obras?.forEach(obra => {
      obra.asignaciones?.forEach(asig => {
        totalSaldoPendiente += Number(asig.saldoPendiente || 0);
      });
    });
    
    return totalSaldoPendiente;
  };

  // Formatea jornales: si es entero muestra "2", si es fracción muestra "1.5"
  const formatearJornales = (valor) => {
    if (valor === null || valor === undefined) return '0';
    const num = Number(valor);
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
  };

  const getBadgeEstado = (estado) => {
    const badges = {
      'ACTIVO': 'success',
      'FINALIZADO': 'secondary',
      'CANCELADO': 'danger'
    };
    return badges[estado] || 'secondary';
  };

  // 📋 Obtener todos los pagos de un profesional aplanados y ordenados por fecha desc
  const obtenerPagosProfesional = (prof) => {
    const pagos = [];
    prof.obras?.forEach(obra => {
      obra.asignaciones?.forEach(asig => {
        asig.historialPagos?.forEach(pago => {
          pagos.push({
            obraNombre: obra.obraNombre,
            rubroNombre: asig.rubroNombre,
            fechaPago: pago.fechaPago,
            monto: pago.monto,
            observaciones: pago.observaciones
          });
        });
      });
    });
    return pagos.sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago));
  };

  const calcularTotalesGenerales = () => {
    let totalProfesionales = profesionales.length;
    let totalAsignaciones = 0;
    let totalPresupuesto = 0; // 💰 Total de todos los pools
    let totalPagado = 0; // 💰 Total pagado real
    let saldoDisponible = 0; // 💰 Disponible total

    // 💰 Calcular totales desde los pools (evita duplicaciones por valores compartidos)
    Object.values(poolsRubros).forEach(pool => {
      totalPresupuesto += Number(pool.importeTotal || 0);
      totalPagado += Number(pool.importePagado || 0); // ✅ Usar pool (no suma duplicada)
      saldoDisponible += Number(pool.importeDisponible || 0);
    });

    // Contar obras ÚNICAS (sin duplicar) y asignaciones
    const obrasUnicas = new Set();
    profesionales.forEach(prof => {
      prof.obras?.forEach(obra => {
        obrasUnicas.add(obra.obraId);
      });
      totalAsignaciones += prof.totalAsignaciones || 0;
    });
    const totalObras = obrasUnicas.size;

    return { 
      totalProfesionales, 
      totalObras, 
      totalAsignaciones, 
      totalPresupuesto, 
      totalPagado, 
      saldoDisponible 
    };
  };

  // 💰 Calcular totales agrupados POR RUBRO (para resumen por rubro)
  const calcularTotalesPorRubro = () => {
    const totalesPorRubro = {};

    // Agrupar todos los pools por rubro
    Object.values(poolsRubros).forEach(pool => {
      const rubro = pool.rubroNombre;
      
      if (!totalesPorRubro[rubro]) {
        totalesPorRubro[rubro] = {
          rubroNombre: rubro,
          presupuestoTotal: 0,
          totalPagado: 0,
          saldoDisponible: 0
        };
      }

      totalesPorRubro[rubro].presupuestoTotal += Number(pool.importeTotal || 0);
      totalesPorRubro[rubro].totalPagado += Number(pool.importePagado || 0);
      totalesPorRubro[rubro].saldoDisponible += Number(pool.importeDisponible || 0);
    });

    // Convertir a array y ordenar alfabéticamente por nombre de rubro
    return Object.values(totalesPorRubro).sort((a, b) => 
      a.rubroNombre.localeCompare(b.rubroNombre)
    );
  };

  // 💵 Calcular el total a pagar de todos los importes ingresados
  const calcularTotalAPagar = () => {
    const total = Object.values(importesPago).reduce((sum, valor) => {
      const numero = parseFloat(valor) || 0;
      return sum + numero;
    }, 0);
    console.log('💵 Total a pagar calculado:', total, 'desde importesPago:', importesPago);
    return total;
  };

  // 💵 Guardar importes de pago de un profesional específico
  const guardarImportesProfesional = async (profesional) => {
    // Obtener IDs de todas las asignaciones de este profesional
    const idsAsignaciones = [];
    profesional.obras?.forEach(obra => {
      obra.asignaciones?.forEach(asig => {
        idsAsignaciones.push(asig.asignacionId);
      });
    });

    // Filtrar importes que pertenecen a este profesional
    const importesProfesional = {};
    const fechasProfesional = {};
    idsAsignaciones.forEach(id => {
      if (importesPago[id]) {
        importesProfesional[id] = parseFloat(importesPago[id]) || 0;
        // Usar fecha ingresada o fecha actual si no hay fecha
        fechasProfesional[id] = fechasPago[id] || new Date().toISOString().split('T')[0];
      }
    });

    if (Object.keys(importesProfesional).length === 0) {
      setError('No hay importes ingresados para este profesional');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // 💰 Validar que no se exceda el disponible del pool compartido
    const pagosPorPool = {}; // { "59_Plomeria": { total: 500000, obraId: 59, rubroNombre: "Plomeria" } }
    
    // Agrupar pagos por pool (obra/rubro)
    profesional.obras?.forEach(obra => {
      obra.asignaciones?.forEach(asig => {
        if (importesProfesional[asig.asignacionId]) {
          const poolKey = `${obra.obraId}_${asig.rubroNombre}`;
          if (!pagosPorPool[poolKey]) {
            pagosPorPool[poolKey] = {
              total: 0,
              obraId: obra.obraId,
              obraNombre: obra.obraNombre,
              rubroNombre: asig.rubroNombre
            };
          }
          pagosPorPool[poolKey].total += importesProfesional[asig.asignacionId];
        }
      });
    });

    // Validar cada pool
    for (const poolKey in pagosPorPool) {
      const pagoPool = pagosPorPool[poolKey];
      const pool = obtenerPoolDisponible(pagoPool.obraId, pagoPool.rubroNombre);
      
      if (pagoPool.total > pool.disponible) {
        setError(
          `⚠️ El importe total a pagar para ${pagoPool.rubroNombre} en ${pagoPool.obraNombre} ` +
          `(${formatearMoneda(pagoPool.total)}) excede el presupuesto disponible ` +
          `(${formatearMoneda(pool.disponible)})`
        );
        setTimeout(() => setError(null), 6000);
        setGuardandoPagos(false);
        return;
      }
    }

    setGuardandoPagos(true);
    setError(null);

    try {
      console.log('💾 Guardando pagos para:', profesional.profesionalNombre);
      console.log('📋 Importes:', importesProfesional);
      console.log('📅 Fechas:', fechasProfesional);
      
      // Llamada al backend
      const response = await apiService.post('/api/v1/pagos-profesional-obra/batch', {
        empresaId: idEmpresaActual,
        importesPorAsignacion: importesProfesional,
        fechasPorAsignacion: fechasProfesional,
        tipoPago: 'PAGO_PARCIAL',
        observaciones: `Pago registrado desde modal - ${profesional.profesionalNombre}`
      });
      
      console.log('✅ Respuesta del servidor:', response);
      
      setMensajeExito(`✅ ${response.mensaje || 'Pagos guardados exitosamente'}`);
      setTimeout(() => setMensajeExito(null), 5000);
      
      // Limpiar importes y fechas guardados de este profesional
      const nuevosImportes = { ...importesPago };
      const nuevasFechas = { ...fechasPago };
      idsAsignaciones.forEach(id => {
        delete nuevosImportes[id];
        delete nuevasFechas[id];
      });
      setImportesPago(nuevosImportes);
      setFechasPago(nuevasFechas);
      
      // Recargar datos
      await cargarProfesionalesConsolidados();
      
    } catch (err) {
      console.error('❌ Error al guardar pagos:', err);
      const mensajeError = err.response?.data?.message || err.message || 'Error al guardar los pagos';
      setError(mensajeError);
    } finally {
      setGuardandoPagos(false);
    }
  };

  // Solicitar confirmación para editar
  const solicitarEdicion = (asigId, campo, valorActual) => {
    setCampoAEditar({ asigId, campo, valorActual });
    setMostrarConfirmacion(true);
  };

  // Confirmar edición
  const confirmarEdicion = () => {
    setEditando({ asigId: campoAEditar.asigId, campo: campoAEditar.campo });
    setValorTemporal(campoAEditar.valorActual);
    setMostrarConfirmacion(false);
  };

  // Cancelar edición
  const cancelarEdicion = () => {
    setCampoAEditar(null);
    setMostrarConfirmacion(false);
    setEditando(null);
    setValorTemporal('');
  };

  // Guardar cambio
  const guardarCambio = async (asigId, campo, nuevoValor) => {
    try {
      // Aquí llamarías al endpoint para actualizar la asignación
      // Ejemplo: await apiService.put(`/api/profesionales-obras/${asigId}`, { [campo]: nuevoValor }, { empresaId: empresaSeleccionada.id });

      // 💰 Capturar datos antes de la actualización para ajustar el pool
      let obraIdParaPool = null;
      let rubroNombreParaPool = null;
      let totalAsignadoAnterior = 0;
      let totalAsignadoNuevo = 0;

      // Por ahora, actualizar localmente
      const nuevosProfesionales = profesionales.map(prof => ({
        ...prof,
        obras: prof.obras.map(obra => ({
          ...obra,
          asignaciones: obra.asignaciones.map(asig => {
            if (asig.asignacionId === asigId) {
              // 💰 Guardar datos para actualizar pool
              obraIdParaPool = obra.obraId;
              rubroNombreParaPool = asig.rubroNombre;
              totalAsignadoAnterior = asig.totalAsignado;

              const actualizada = { ...asig, [campo]: Number(nuevoValor) };
              // Recalcular totales si es necesario
              if (campo === 'importeJornal' || campo === 'cantidadJornales') {
                actualizada.totalAsignado = actualizada.importeJornal * actualizada.cantidadJornales;
                actualizada.saldoPendiente = actualizada.totalAsignado - actualizada.totalUtilizado;
                actualizada.jornalesRestantes = actualizada.cantidadJornales - actualizada.jornalesUtilizados;
                totalAsignadoNuevo = actualizada.totalAsignado;
              } else {
                totalAsignadoNuevo = actualizada.totalAsignado;
              }
              return actualizada;
            }
            return asig;
          })
        }))
      }));

      setProfesionales(nuevosProfesionales);

      // 💰 Actualizar pool si cambió el total asignado
      if (obraIdParaPool && rubroNombreParaPool && totalAsignadoAnterior !== totalAsignadoNuevo) {
        actualizarPoolAlAsignar(obraIdParaPool, rubroNombreParaPool, totalAsignadoAnterior, totalAsignadoNuevo);
      }

      setEditando(null);
      setValorTemporal('');

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error al guardar cambio:', err);
      setError('Error al guardar los cambios');
    }
  };

  // Componente de campo editable
  const CampoEditable = ({ asigId, campo, valor, esMoneda = false }) => {
    const estaEditando = editando?.asigId === asigId && editando?.campo === campo;

    if (estaEditando) {
      return (
        <input
          type="number"
          className="form-control form-control-sm text-end"
          value={valorTemporal}
          onChange={(e) => setValorTemporal(e.target.value)}
          onBlur={() => {
            if (valorTemporal !== String(valor)) {
              guardarCambio(asigId, campo, valorTemporal);
            } else {
              cancelarEdicion();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              guardarCambio(asigId, campo, valorTemporal);
            } else if (e.key === 'Escape') {
              cancelarEdicion();
            }
          }}
          autoFocus
          style={{ minWidth: '100px' }}
        />
      );
    }

    const valorMostrar = esMoneda ? formatearMoneda(valor) : valor;

    return (
      <span
        className="fw-bold"
        onClick={() => solicitarEdicion(asigId, campo, valor)}
        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
        title="Click para editar"
      >
        {valorMostrar}
      </span>
    );
  };

  const renderAsignacionesTable = (asignaciones, obraNombre, saldoDisponibleGlobal) => {
    if (!asignaciones || asignaciones.length === 0) {
      return (
        <Alert variant="info" className="mb-0 text-center">
          No hay asignaciones en esta obra
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive size="sm" className="mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: '25%' }}>Rubro</th>
            <th style={{ width: '20%' }} className="text-end">Importe a Pagar</th>
            <th style={{ width: '15%' }} className="text-center">Fecha de Pago</th>
            <th style={{ width: '15%' }} className="text-end">Total Pagado</th>
            <th style={{ width: '15%' }} className="text-end">Saldo Pendiente</th>
            <th style={{ width: '10%' }} className="text-center">Historial</th>
          </tr>
        </thead>
        <tbody>
          {asignaciones.map((asig, idx) => (
            <tr key={idx}>
              <td>
                <div>
                  <strong className="text-primary">{asig.rubroNombre || 'Sin rubro'}</strong>
                  {asig.descripcion && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                      {asig.descripcion}
                    </div>
                  )}
                </div>
              </td>
              <td className="text-end">
                <input
                  type="number"
                  className="form-control form-control-sm text-end"
                  placeholder="$0"
                  value={importesPago[asig.asignacionId] || ''}
                  onChange={(e) => {
                    const valor = e.target.value;
                    console.log('💰 Actualizando importe:', { asignacionId: asig.asignacionId, valor, estadoActual: importesPago });
                    setImportesPago(prev => {
                      const nuevo = {
                        ...prev,
                        [asig.asignacionId]: valor
                      };
                      console.log('💰 Nuevo estado importesPago:', nuevo);
                      return nuevo;
                    });
                  }}
                  style={{ minWidth: '100px' }}
                />
              </td>
              <td className="text-center">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={fechasPago[asig.asignacionId] || ''}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setFechasPago(prev => ({
                      ...prev,
                      [asig.asignacionId]: valor
                    }));
                  }}
                  style={{ minWidth: '120px' }}
                  placeholder="Fecha pago"
                />
              </td>
              <td className="text-end">
                <span className="fw-bold text-success">{formatearMoneda(asig.totalPagado || 0)}</span>
              </td>
              <td className="text-end">
                <span className="fw-bold text-primary">
                  {formatearMoneda(asig.saldoPendiente || 0)}
                </span>
              </td>
              <td className="text-center">
                {asig.historialPagos && asig.historialPagos.length > 0 ? (
                  <OverlayTrigger
                    trigger="click"
                    placement="left"
                    rootClose
                    overlay={
                      <Popover id={`popover-historial-${asig.asignacionId}`}>
                        <Popover.Header as="h3">
                          <i className="bi bi-clock-history me-2"></i>
                          Historial de Pagos
                        </Popover.Header>
                        <Popover.Body>
                          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {asig.historialPagos.map((pago, idx) => (
                              <div key={idx} className="border-bottom pb-2 mb-2">
                                <div className="d-flex justify-content-between">
                                  <strong className="text-primary">{formatearMoneda(pago.monto)}</strong>
                                  <small className="text-muted">
                                    {new Date(pago.fechaPago).toLocaleDateString('es-AR')}
                                  </small>
                                </div>
                                {pago.observaciones && (
                                  <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                    {pago.observaciones}
                                  </small>
                                )}
                              </div>
                            ))}
                            <div className="mt-2 pt-2 border-top">
                              <strong>Total: {asig.historialPagos.length} pago(s)</strong>
                            </div>
                          </div>
                        </Popover.Body>
                      </Popover>
                    }
                  >
                    <Button variant="outline-info" size="sm">
                      <i className="bi bi-clock-history"></i>
                      <Badge bg="info" className="ms-1">{asig.historialPagos.length}</Badge>
                    </Button>
                  </OverlayTrigger>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderObrasDeProfesional = (obras, profesionalNombre, profesional) => {
    if (!obras || obras.length === 0) {
      return (
        <Alert variant="warning" className="mb-0">
          <i className="bi bi-info-circle me-2"></i>
          Este profesional no tiene obras asignadas
        </Alert>
      );
    }

    return (
      <div className="obras-container">
        {obras.map((obra, idxObra) => {
          // 💰 Obtener rubros únicos de esta obra
          const rubrosUnicos = [...new Set(obra.asignaciones.map(a => a.rubroNombre))];
          
          // 💰 Calcular saldo pendiente total de esta obra específica
          const saldoPendienteObra = obra.asignaciones.reduce((sum, asig) => sum + (Number(asig.saldoPendiente) || 0), 0);

          return (
            <div key={idxObra} className="obra-section mb-4 border rounded p-3 bg-light">
              {/* Header de la Obra */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h6 className="mb-0 text-primary">
                    <i className="bi bi-building me-2"></i>
                    <strong>{obra.obraNombre || `Obra ${idxObra + 1}`}</strong>
                  </h6>
                  {obra.direccionCompleta && (
                    <small className="text-muted">
                      <i className="bi bi-geo-alt-fill me-1"></i>
                      {obra.direccionCompleta}
                    </small>
                  )}

                  {/* 💰 Pools de Rubros */}
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    {rubrosUnicos.map((rubroNombre, idx) => {
                      const pool = obtenerPoolDisponible(obra.obraId, rubroNombre);
                      const poolKey = `${obra.obraId}_${rubroNombre}`;
                      const estaEditandoPool = editandoPool?.poolKey === poolKey;

                      return (
                        <div
                          key={idx}
                          className="badge bg-info bg-opacity-75 text-dark d-flex align-items-center gap-2" 
                          style={{ 
                            fontSize: '0.85rem', 
                            padding: '0.4rem 0.6rem',
                            cursor: estaEditandoPool ? 'default' : 'pointer'
                          }}
                          onClick={() => !estaEditandoPool && solicitarEdicionPool(obra.obraId, rubroNombre, pool.total)}
                        >
                          <strong>{rubroNombre}:</strong>
                          {estaEditandoPool ? (
                            <>
                              <input
                                type="number"
                                className="form-control form-control-sm d-inline-block"
                                style={{ width: '120px', fontSize: '0.8rem' }}
                                value={valorTemporalPool}
                                onChange={(e) => setValorTemporalPool(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    guardarCambioPool(poolKey, valorTemporalPool);
                                  } else if (e.key === 'Escape') {
                                    cancelarEdicionPool();
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="success"
                                className="ms-2"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  guardarCambioPool(poolKey, valorTemporalPool);
                                }}
                              >
                                <i className="bi bi-check-lg"></i> Aceptar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="ms-1"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelarEdicionPool();
                                }}
                              >
                                <i className="bi bi-x-lg"></i>
                              </Button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 'bold', color: pool.disponible < 0 ? '#dc3545' : '#0d6efd' }}>
                                {formatearMoneda(pool.disponible)}
                              </span>
                              <span style={{ fontSize: '0.75rem' }}> / </span>
                              <span style={{ fontWeight: 'normal', color: '#6c757d' }}>
                                {formatearMoneda(pool.total)}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontStyle: 'italic', marginLeft: '0.3rem' }}>
                                - Editar importe
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="d-flex gap-3 align-items-center">
                  <Badge bg="secondary">{obra.obraEstado || 'N/A'}</Badge>
                  <small className="text-muted">
                    <i className="bi bi-list-check me-1"></i>
                    {obra.totalAsignaciones || 0} asignaciones
                  </small>
                  <Badge bg="danger">
                    Pendiente: {formatearMoneda(saldoPendienteObra)}
                  </Badge>
                </div>
              </div>

              {/* Tabla de Asignaciones de la Obra */}
              {renderAsignacionesTable(obra.asignaciones, obra.obraNombre, saldoPendienteObra)}
            </div>
          );
        })}
        
        {/* Botón Actualizar al pie del profesional */}
        <div className="d-flex justify-content-end mt-3 pt-3 border-top">
          <Button 
            variant="primary" 
            onClick={() => guardarImportesProfesional(profesional)}
            disabled={guardandoPagos || !profesional.obras?.some(obra => 
              obra.asignaciones?.some(asig => importesPago[asig.asignacionId])
            )}
          >
            {guardandoPagos ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Actualizar Pagos
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const totalesGenerales = calcularTotalesGenerales();

  return (
    <>
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      backdrop="static"
      className="modal-gestion-pagos-profesionales"
    >
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>
          <i className="bi bi-people-fill me-2"></i>
          Gestión de Pagos por Profesional
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Error */}
        {error && (
          <Alert variant="danger" className="mb-3" onClose={() => setError(null)} dismissible>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </Alert>
        )}
        
        {/* Mensaje de Éxito */}
        {mensajeExito && (
          <Alert variant="success" className="mb-3" onClose={() => setMensajeExito(null)} dismissible>
            <i className="bi bi-check-circle-fill me-2"></i>
            {mensajeExito}
          </Alert>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Cargando información de pagos...</p>
          </div>
        ) : (
          <>
            {/* Resumen General */}
            <div className="row mb-4">
              <div className="col-md-12">
                <div className="card border-primary shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title text-primary mb-3">
                      <i className="bi bi-bar-chart-fill me-2"></i>
                      Resumen por Rubro
                    </h6>
                    
                    {/* Contadores básicos - fila compacta */}
                    <div className="row text-center mb-3">
                      <div className="col-auto">
                        <div className="border rounded p-2 bg-light d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                          <i className="bi bi-people-fill text-primary"></i>
                          <strong className="text-primary">{totalesGenerales.totalProfesionales}</strong>
                          <small className="text-muted">Profesionales</small>
                        </div>
                      </div>
                      <div className="col-auto">
                        <div className="border rounded p-2 bg-light d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                          <i className="bi bi-building text-info"></i>
                          <strong className="text-info">{totalesGenerales.totalObras}</strong>
                          <small className="text-muted">Obras</small>
                        </div>
                      </div>
                      <div className="col-auto">
                        <div className="border rounded p-2 bg-light d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                          <i className="bi bi-list-check text-secondary"></i>
                          <strong className="text-secondary">{totalesGenerales.totalAsignaciones}</strong>
                          <small className="text-muted">Asignaciones</small>
                        </div>
                      </div>
                    </div>

                    {/* Tabla de totales por rubro */}
                    {calcularTotalesPorRubro().length === 0 ? (
                      <Alert variant="info" className="mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        No hay rubros con asignaciones activas
                      </Alert>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '30%' }}>
                                <i className="bi bi-tag-fill me-2 text-primary"></i>
                                Rubro
                              </th>
                              <th className="text-end" style={{ width: '23%' }}>
                                <i className="bi bi-cash-stack me-1 text-info"></i>
                                Presupuesto Total
                              </th>
                              <th className="text-end" style={{ width: '23%' }}>
                                <i className="bi bi-check-circle-fill me-1 text-success"></i>
                                Total Pagado
                              </th>
                              <th className="text-end" style={{ width: '24%' }}>
                                <i className="bi bi-wallet2 me-1 text-primary"></i>
                                Saldo Disponible
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {calcularTotalesPorRubro().map((rubro, idx) => (
                              <tr key={idx}>
                                <td>
                                  <Badge bg="secondary" className="me-2">{idx + 1}</Badge>
                                  <strong>{rubro.rubroNombre}</strong>
                                </td>
                                <td className="text-end">
                                  <span className="badge bg-info bg-opacity-75 text-dark" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                    {formatearMoneda(rubro.presupuestoTotal)}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <span className="badge bg-success bg-opacity-75 text-dark" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                    {formatearMoneda(rubro.totalPagado)}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <span 
                                    className={`badge ${rubro.saldoDisponible < 0 ? 'bg-danger' : 'bg-primary'} bg-opacity-75 ${rubro.saldoDisponible < 0 ? 'text-white' : 'text-dark'}`}
                                    style={{ fontSize: '0.9rem', fontWeight: '500' }}
                                  >
                                    {formatearMoneda(rubro.saldoDisponible)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {/* Fila de totales generales */}
                            <tr className="table-primary fw-bold">
                              <td>
                                <i className="bi bi-calculator me-2"></i>
                                <strong>TOTALES GENERALES</strong>
                              </td>
                              <td className="text-end">
                                <strong>{formatearMoneda(totalesGenerales.totalPresupuesto)}</strong>
                              </td>
                              <td className="text-end">
                                <strong>{formatearMoneda(totalesGenerales.totalPagado)}</strong>
                              </td>
                              <td className="text-end">
                                <strong>{formatearMoneda(totalesGenerales.saldoDisponible)}</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Listado de Profesionales con Acordeón */}
            {profesionales.length === 0 ? (
              <Alert variant="info" className="text-center">
                <i className="bi bi-info-circle me-2"></i>
                No hay profesionales con asignaciones activas
              </Alert>
            ) : (
              <Accordion>
                {profesionales.map((prof, idx) => (
                  <Accordion.Item eventKey={String(idx)} key={idx}>
                    <Accordion.Header>
                      <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                        <div>
                          <div>
                            <strong className="text-primary fs-5">
                              <i className="bi bi-person-fill me-2"></i>
                              {prof.profesionalNombre || `Profesional ${idx + 1}`}
                            </strong>
                          </div>
                          <div className="mt-1">
                            {prof.profesionalDni && (
                              <small className="text-muted me-3">
                                <i className="bi bi-card-text me-1"></i>
                                DNI: {prof.profesionalDni}
                              </small>
                            )}
                            {prof.profesionalTelefono && (
                              <small className="text-muted me-3">
                                <i className="bi bi-telephone-fill me-1"></i>
                                {prof.profesionalTelefono}
                              </small>
                            )}
                            {prof.profesionalEmail && (
                              <small className="text-muted">
                                <i className="bi bi-envelope-fill me-1"></i>
                                {prof.profesionalEmail}
                              </small>
                            )}
                            {/* Último pago con desplegable de historial completo */}
                            {(() => {
                              const pagos = obtenerPagosProfesional(prof);
                              if (pagos.length === 0) return null;
                              const ultimo = pagos[0];
                              return (
                                <OverlayTrigger
                                  trigger="click"
                                  placement="bottom"
                                  rootClose
                                  overlay={
                                    <Popover id={`popover-pagos-${prof.profesionalId}`} style={{ maxWidth: '420px' }}>
                                      <Popover.Header as="h6">
                                        <i className="bi bi-clock-history me-2"></i>
                                        Historial de pagos — {pagos.length} pago(s)
                                      </Popover.Header>
                                      <Popover.Body className="p-0">
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                          <table className="table table-sm table-striped mb-0" style={{ fontSize: '0.8rem' }}>
                                            <thead className="table-light">
                                              <tr>
                                                <th>Obra</th>
                                                <th>Rubro</th>
                                                <th>Fecha</th>
                                                <th className="text-end">Importe</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {pagos.map((p, i) => (
                                                <tr key={i}>
                                                  <td>{p.obraNombre}</td>
                                                  <td>{p.rubroNombre}</td>
                                                  <td>{new Date(p.fechaPago).toLocaleDateString('es-AR')}</td>
                                                  <td className="text-end fw-bold text-success">{formatearMoneda(p.monto)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </Popover.Body>
                                    </Popover>
                                  }
                                >
                                  <div
                                    className="mt-1 d-inline-flex align-items-center gap-2 border rounded px-2 py-1"
                                    style={{ cursor: 'pointer', backgroundColor: '#f0f9ff', borderColor: '#0dcaf0 !important', border: '1px solid #0dcaf0', fontSize: '0.82rem' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <i className="bi bi-cash-coin text-info"></i>
                                    <span>
                                      <span className="text-muted">Último pago:</span>{' '}
                                      <strong>{ultimo.obraNombre}</strong> · {ultimo.rubroNombre} · {new Date(ultimo.fechaPago).toLocaleDateString('es-AR')} · <span className="text-success fw-bold">{formatearMoneda(ultimo.monto)}</span>
                                    </span>
                                    <Badge bg="info" className="ms-1">{pagos.length} pagos</Badge>
                                    <span className="text-info fw-bold" style={{ fontSize: '0.75rem' }}>
                                      Ver todos <i className="bi bi-chevron-down"></i>
                                    </span>
                                  </div>
                                </OverlayTrigger>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="d-flex gap-3 align-items-center">
                          <div className="text-center">
                            <div className="fw-bold text-info">{prof.totalObras || 0}</div>
                            <small className="text-muted">Obras</small>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-secondary">{prof.totalAsignaciones || 0}</div>
                            <small className="text-muted">Asignaciones</small>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-primary">{formatearMoneda(calcularPresupuestoBaseProfesional(prof))}</div>
                            <small className="text-muted">Ppto. Base</small>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-primary">{formatearMoneda(calcularSaldoPendienteProfesional(prof))}</div>
                            <small className="text-muted">Pendiente</small>
                          </div>
                        </div>
                      </div>
                    </Accordion.Header>
                    <Accordion.Body className="bg-white">
                      {renderObrasDeProfesional(prof.obras, prof.profesionalNombre, prof)}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light">
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="d-flex gap-3">
            <div className="border rounded p-2 bg-white">
              <small className="text-muted d-block">Total a Pagar:</small>
              <h5 className="mb-0 text-success">{formatearMoneda(calcularTotalAPagar())}</h5>
            </div>
            <div className="border rounded p-2 bg-info bg-opacity-10">
              <small className="text-muted d-block">Asignaciones con pago:</small>
              <h6 className="mb-0 text-info">{Object.keys(importesPago).filter(k => importesPago[k]).length}</h6>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="success" onClick={onHide}>
              <i className="bi bi-check-circle me-2"></i>
              Aceptar Configuración
            </Button>
            <Button variant="secondary" onClick={onHide}>
              <i className="bi bi-x-circle me-2"></i>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>

    {/* Modal de Confirmación */}
    <Modal show={mostrarConfirmacion} onHide={() => setMostrarConfirmacion(false)} centered>
      <Modal.Header closeButton className="bg-warning text-dark">
        <Modal.Title>
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Confirmación de Edición
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">
          ¿Está seguro de que desea editar este campo?
        </p>
        <small className="text-muted">
          Los cambios se guardarán automáticamente al terminar de editar.
        </small>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setMostrarConfirmacion(false)}>
          <i className="bi bi-x-circle me-2"></i>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmarEdicion}>
          <i className="bi bi-check-circle me-2"></i>
          Aceptar
        </Button>
      </Modal.Footer>
    </Modal>

    {/* 💰 Modal de Confirmación para Editar Pool */}
    <Modal show={mostrarConfirmacionPool} onHide={() => setMostrarConfirmacionPool(false)} centered>
      <Modal.Header closeButton className="bg-info text-dark">
        <Modal.Title>
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Editar Total del Presupuesto
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          ¿Está seguro de que desea modificar el total del presupuesto de este rubro?
        </p>
        <small className="text-muted">
          <strong>Importante:</strong> Este cambio afectará el saldo disponible para asignar a los profesionales de este rubro en esta obra.
        </small>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setMostrarConfirmacionPool(false)}>
          <i className="bi bi-x-circle me-2"></i>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmarEdicionPool}>
          <i className="bi bi-check-circle me-2"></i>
          Aceptar
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
};

export default GestionPagosProfesionalesModal;
