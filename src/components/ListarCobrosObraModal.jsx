import React, { useState, useEffect } from 'react';
import {
  listarCobrosPorObra,
  marcarComoCobrado,
  anularCobro,
  eliminarCobro,
  obtenerTotalCobrado,
  obtenerTotalPendiente,
  formatearMoneda,
  formatearFecha,
  obtenerEstadoCobro,
  estaVencido
} from '../services/cobrosObraService';
import { obtenerAsignacionesDeCobro } from '../services/asignacionesCobroObraService';
import { useEmpresa } from '../EmpresaContext';
import DireccionObraSelector from './DireccionObraSelector';
import api from '../services/api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

const ListarCobrosObraModal = ({ show, onHide, onSuccess, obraDireccion, modoConsolidado, obrasSeleccionadas, obrasDisponibles, refreshTrigger }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [cobros, setCobros] = useState([]);
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(obraDireccion || null);
  const [totalPresupuesto, setTotalPresupuesto] = useState(0);
  const [totalCobrado, setTotalCobrado] = useState(0);
  const [totalPendiente, setTotalPendiente] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Determinar si hay selección parcial
  const haySeleccionParcial = modoConsolidado && obrasSeleccionadas && obrasSeleccionadas.size > 0;

  useEffect(() => {
    if (obraDireccion) {
      setDireccionSeleccionada(obraDireccion);
    }
  }, [obraDireccion]);

  // Auto-actualización cuando el modal se abre o cambian los datos del presupuesto
  useEffect(() => {
    if (show && empresaSeleccionada) {
      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else if (direccionSeleccionada) {
        cargarCobros();
      }
    }
  }, [show, direccionSeleccionada, empresaSeleccionada, modoConsolidado, refreshTrigger]);

  const cargarCobrosConsolidados = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔵 DIAGNOSTICO_MODAL 🔵 Iniciando carga');

      // 1. Cargar TODAS las obras primero
      let obrasACargar = [];
      try {
        const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
        let presupuestos = Array.isArray(response) ? response :
                          response?.datos || response?.content || response?.data || [];

        console.log('🔵 DIAGNOSTICO_MODAL presupuestos obtenidos:', presupuestos.length);

        // Filtrar solo APROBADO y EN_EJECUCION
        presupuestos = presupuestos.filter(p =>
          p.estado === 'APROBADO' || p.estado === 'EN_EJECUCION'
        );

        console.log('🔵 DIAGNOSTICO_MODAL presupuestos filtrados:', presupuestos.length);
        console.log('🔵 DIAGNOSTICO_MODAL primer presupuesto completo:', presupuestos[0]);

        // Agrupar por obra y tomar última versión
        const obrasPorNombre = {};
        presupuestos.forEach(p => {
          const clave = `${p.direccionObraCalle}-${p.direccionObraAltura}`;
          if (!obrasPorNombre[clave] || p.version > obrasPorNombre[clave].version) {
            obrasPorNombre[clave] = {
              id: p.id,
              nombreObra: `${p.direccionObraCalle} ${p.direccionObraAltura}${p.direccionObraBarrio ? ' - ' + p.direccionObraBarrio : ''}`,
              direccionObraCalle: p.direccionObraCalle,
              direccionObraAltura: p.direccionObraAltura,
              direccionObraBarrio: p.direccionObraBarrio,
              totalPresupuesto: p.totalFinal || p.totalPresupuestoConHonorarios || p.montoTotal || 0,
              version: p.version,
              estado: p.estado
            };
          }
        });

        obrasACargar = Object.values(obrasPorNombre);
        console.log('🔵 DIAGNOSTICO_MODAL obras agrupadas:', obrasACargar.length);

        // 🆕 Cargar trabajos extra para cada obra
        const obrasConTrabajosExtra = await Promise.all(obrasACargar.map(async (obra) => {
          try {
            const obraId = obra.obraId || presupuestos.find(p => p.id === obra.id)?.obraId;
            if (obraId) {
              const responseTE = await api.trabajosExtra.getAll(empresaSeleccionada.id, { obraId });
              const trabajos = Array.isArray(responseTE) ? responseTE : responseTE?.data || [];

              // Obtener detalles completos de cada trabajo extra
              const trabajosCompletos = await Promise.all(trabajos.map(async (t) => {
                try {
                  const fullResponse = await api.trabajosExtra.getById(t.id, empresaSeleccionada.id);
                  const fullTrabajo = fullResponse.data || fullResponse;

                  // Calcular total con la misma lógica que useEstadisticasConsolidadas
                  let totalCalculado = 0;
                  if (fullTrabajo.itemsCalculadora && Array.isArray(fullTrabajo.itemsCalculadora) && fullTrabajo.itemsCalculadora.length > 0) {
                    const parseMontoLocal = (val) => {
                      if (typeof val === 'number') return val;
                      if (!val) return 0;
                      let str = String(val).trim().replace(/[^0-9.,-]/g, '');
                      if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
                      return parseFloat(str) || 0;
                    };

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
                    totalCalculado = parseFloat(fullTrabajo.totalFinal) || parseFloat(fullTrabajo.montoTotal) || 0;
                  }

                  return {
                    id: fullTrabajo.id,
                    nombre: fullTrabajo.nombre,
                    totalCalculado: totalCalculado
                  };
                } catch (err) {
                  return { id: t.id, nombre: t.nombre, totalCalculado: parseFloat(t.totalFinal) || 0 };
                }
              }));

              return { ...obra, trabajosExtra: trabajosCompletos };
            }
            return obra;
          } catch (error) {
            console.warn(`⚠️ Error cargando trabajos extra de obra ${obra.nombreObra}:`, error);
            return obra;
          }
        }));

        obrasACargar = obrasConTrabajosExtra;
        obrasACargar.forEach((obra, idx) => {
          const totalTE = obra.trabajosExtra?.reduce((sum, te) => sum + (te.totalCalculado || 0), 0) || 0;
          console.log(`🔵 DIAGNOSTICO_MODAL obra ${idx}: ${obra.nombreObra} - base: ${obra.totalPresupuesto} + TE: ${totalTE} = ${obra.totalPresupuesto + totalTE}`);
        });

        // Si hay selección parcial, filtrar
        if (haySeleccionParcial && obrasSeleccionadas && obrasSeleccionadas.size > 0) {
          const idsSeleccionados = Array.from(obrasSeleccionadas);
          obrasACargar = obrasACargar.filter(o => idsSeleccionados.includes(o.id));
          console.log('🔵 DIAGNOSTICO_MODAL obras después de filtro selección:', obrasACargar.length);
        }
      } catch (error) {
        console.error('Error cargando obras:', error);
      }

      // 2. Cargar cobros directos de cada obra
      const promesasCobros = obrasACargar.map(obra =>
        listarCobrosPorObra({
          presupuestoNoClienteId: obra.id,
          calle: obra.direccionObraCalle,
          altura: obra.direccionObraAltura,
          barrio: obra.direccionObraBarrio,
          torre: obra.direccionObraTorre,
          piso: obra.direccionObraPiso,
          depto: obra.direccionObraDepto
        }, empresaSeleccionada.id)
          .then(cobros => ({ obra, cobros: Array.isArray(cobros) ? cobros : [] }))
          .catch(err => {
            console.warn(`⚠️ Error cargando cobros de obra ${obra.nombreObra}:`, err.message);
            return { obra, cobros: [] };
          })
      );

      const resultados = await Promise.all(promesasCobros);

      console.log('🔵 DIAGNOSTICO_MODAL resultados de cobros por obra:', resultados);

      // Combinar todos los cobros
      let cobrosObra = [];
      resultados.forEach(({ obra, cobros }) => {
        const cobrosEnriquecidos = cobros.map(c => ({
          ...c,
          tipo: 'OBRA',
          nombreObra: obra.nombreObra
        }));
        cobrosObra = [...cobrosObra, ...cobrosEnriquecidos];
      });

      console.log(`📦 Total cobros directos de obra: ${cobrosObra.length}`);

      // 3. Cargar cobros a la empresa (Gisel, etc.)
      let cobrosEmpresa = [];
      let totalCobradoEmpresa = 0;
      try {
        const { listarCobrosEmpresa, obtenerResumenCobrosEmpresa } = await import('../services/cobrosEmpresaService');

        // Obtener total
        const resumen = await obtenerResumenCobrosEmpresa(empresaSeleccionada.id);
        totalCobradoEmpresa = parseFloat(resumen?.totalCobrado || 0);

        // Obtener lista de cobros
        const cobrosEmp = await listarCobrosEmpresa(empresaSeleccionada.id);
        cobrosEmpresa = (Array.isArray(cobrosEmp) ? cobrosEmp : []).map(c => ({
          ...c,
          monto: c.montoTotal || c.monto || 0, // Normalizar campo monto
          tipo: 'EMPRESA',
          nombreObra: `Cobro a ${empresaSeleccionada.razonSocial || 'Empresa'}`
        }));

        console.log('💰 Total cobrado empresa:', totalCobradoEmpresa);
        console.log('💰 Cobros empresa individuales:', cobrosEmpresa.length);
      } catch (error) {
        console.warn('⚠️ Error obteniendo cobros empresa:', error.message);
        totalCobradoEmpresa = 0;
      }

      // 4. Cargar asignaciones de cobros empresa a las obras seleccionadas
      let totalAsignacionesObras = 0;
      try {
        const { obtenerDistribucionPorObra } = await import('../services/cobrosEmpresaService');
        const distribucion = await obtenerDistribucionPorObra(empresaSeleccionada.id);

        if (distribucion && Array.isArray(distribucion)) {
          const idsObras = obrasACargar.map(o => o.id);
          distribucion.forEach(dist => {
            if (dist.obraId && idsObras.includes(dist.obraId)) {
              totalAsignacionesObras += parseFloat(dist.totalAsignado || 0);
            }
          });
        }
        console.log(`💰 Total asignaciones de cobros empresa a obras seleccionadas: $${totalAsignacionesObras}`);
      } catch (error) {
        console.warn('⚠️ Error cargando distribución cobros empresa:', error.message);
      }

      // 5. Combinar cobros de obra + cobros empresa
      const todosCobros = [...cobrosObra, ...cobrosEmpresa];

      // Cargar asignaciones de ítems para cada cobro
      console.log('📊 Cargando asignaciones de ítems...');
      const cobrosConAsignaciones = await Promise.all(
        todosCobros.map(async (cobro) => {
          try {
            // Para cobros de empresa, no hay asignaciones por ítems
            // (se asignan completos a obras, no se distribuyen por profesionales/materiales)
            if (cobro.tipo === 'EMPRESA') {
              return {
                ...cobro,
                asignaciones: [] // Los cobros empresa no tienen distribución por ítems
              };
            }

            // Para cobros de obra, sí hay asignaciones por ítems
            const asignaciones = await obtenerAsignacionesDeCobro(cobro.id, empresaSeleccionada.id);
            return {
              ...cobro,
              asignaciones: asignaciones || []
            };
          } catch (error) {
            console.error(`⚠️ Error cargando asignaciones para cobro ${cobro.id}:`, error);
            return {
              ...cobro,
              asignaciones: []
            };
          }
        })
      );

      setCobros(cobrosConAsignaciones);

      // 5. Calcular totales
      // Total Cobrado = el TOTAL COBRADO a la empresa (no las asignaciones)
      const totalCobradoCalculado = totalCobradoEmpresa;

      const totalPresupuestoCalculado = obrasACargar.reduce((sum, obra) => {
        let presupuesto = parseFloat(
          obra.totalPresupuesto ||
          obra.totalFinal ||
          obra.totalPresupuestoConHonorarios ||
          obra.presupuestoCompleto?.totalFinal ||
          obra.presupuestoCompleto?.totalPresupuestoConHonorarios ||
          obra.presupuestoCompleto?.montoTotal ||
          0
        );

        // 🆕 Sumar trabajos extra si existen
        if (obra.trabajosExtra && Array.isArray(obra.trabajosExtra)) {
          const totalTrabajosExtra = obra.trabajosExtra.reduce((sum, te) => {
            return sum + (parseFloat(te.totalCalculado) || parseFloat(te.totalFinal) || 0);
          }, 0);
          presupuesto += totalTrabajosExtra;
          console.log(`🔵 DIAGNOSTICO_MODAL obra ${obra.nombreObra} - base: ${obra.totalPresupuesto} + trabajos extra: ${totalTrabajosExtra} = ${presupuesto}`);
        } else {
          console.log(`🔵 DIAGNOSTICO_MODAL sumando obra ${obra.nombreObra}:`, presupuesto);
        }

        return sum + presupuesto;
      }, 0);

      console.log('🔵 DIAGNOSTICO_MODAL totalPresupuestoCalculado final:', totalPresupuestoCalculado);
      console.log('🔵 DIAGNOSTICO_MODAL totalCobradoCalculado final:', totalCobradoCalculado);

      const pendienteCalculado = totalPresupuestoCalculado - totalCobradoCalculado;
      console.log('🔵 DIAGNOSTICO_MODAL pendienteCalculado final:', pendienteCalculado);

      setTotalCobrado(totalCobradoCalculado);
      setTotalPendiente(pendienteCalculado > 0 ? pendienteCalculado : 0);
      setTotalPresupuesto(totalPresupuestoCalculado);

      console.log('💰 Resumen:', {
        obras: obrasACargar.length,
        cobrosDirectos: cobrosObra.length,
        totalCobradoEmpresa, // ← Este es el valor REAL ($30M)
        asignacionesAObras: totalAsignacionesObras, // ← Esto es solo parte ($18M)
        totalPresupuesto: totalPresupuestoCalculado,
        pendiente: pendienteCalculado
      });

      console.log(`✅ Cargados ${cobrosConAsignaciones.length} cobros`);

      // Log del resultado final
      console.log('📋 Cobros finales:', cobrosConAsignaciones);
    } catch (err) {
      console.error('❌ Error cargando cobros consolidados:', err);
      console.error('❌ Stack:', err.stack);
      // Si el error es 404 (no encontrado), no mostrar error, solo dejar vacío
      if (err.response?.status === 404 || err.response?.status === 204) {
        console.log('ℹ️ No hay cobros registrados para esta empresa');
        setCobros([]);
        setTotalCobrado(0);
        setTotalPendiente(0);
        setTotalPresupuesto(0);
      } else {
        // Solo mostrar error si es un error real del servidor
        setError(`Error al cargar cobros: ${err.message}`);
        setCobros([]);
        setTotalCobrado(0);
        setTotalPendiente(0);
        setTotalPresupuesto(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const cargarCobros = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!direccionSeleccionada?.presupuestoNoClienteId) {
        setCobros([]);
        setTotalPresupuesto(0);
        setTotalCobrado(0);
        setTotalPendiente(0);
        setLoading(false);
        return;
      }

      // Cargar el presupuesto para obtener el total
      const presupuestoResponse = await api.presupuestosNoCliente.getById(
        direccionSeleccionada.presupuestoNoClienteId,
        empresaSeleccionada.id
      );

      const presupuesto = presupuestoResponse?.datos || presupuestoResponse?.data || presupuestoResponse;
      const totalPpto = presupuesto?.totalPresupuestoConHonorarios || presupuesto?.totalPresupuesto || 0;

      setTotalPresupuesto(totalPpto);

      // Cargar cobros
      const data = await listarCobrosPorObra(direccionSeleccionada, empresaSeleccionada.id);
      const cobrosArray = Array.isArray(data) ? data : [];
      setCobros(cobrosArray);

      // Calcular total cobrado (solo cobros en estado COBRADO)
      const cobrado = cobrosArray
        .filter(c => c.estado === 'COBRADO')
        .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

      // Total pendiente = Total del presupuesto - Total cobrado
      const pendiente = totalPpto - cobrado;

      setTotalCobrado(cobrado);
      setTotalPendiente(pendiente);
    } catch (err) {
      console.error('❌ Error cargando cobros:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Error desconocido';
      setError(`Error al cargar cobros: ${errorMsg}. Por favor intente nuevamente.`);
      setCobros([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarTotales = async () => {
    try {
      const [cobrado, pendiente] = await Promise.all([
        obtenerTotalCobrado(direccionSeleccionada, empresaSeleccionada.id),
        obtenerTotalPendiente(direccionSeleccionada, empresaSeleccionada.id)
      ]);
      setTotalCobrado(cobrado || 0);
      setTotalPendiente(pendiente || 0);
    } catch (err) {
      console.error('Error cargando totales:', err);
    }
  };

  const handleMarcarCobrado = async (cobroId) => {
    const confirmar = window.confirm('¿Confirmar que este cobro fue efectivamente cobrado?');
    if (!confirmar) return;

    try {
      await marcarComoCobrado(cobroId, null, empresaSeleccionada.id);

      // 📡 Notificar al contexto centralizado
      const cobro = cobros.find(c => c.id === cobroId);
      if (cobro) {
        eventBus.emit(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, {
          presupuestoId: cobro.presupuestoNoClienteId,
          cobroId
        });
      }

      if (onSuccess) {
        onSuccess({
          mensaje: '✅ Cobro marcado como cobrado exitosamente'
        });
      }

      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else {
        cargarCobros();
      }
    } catch (err) {
      console.error('Error marcando cobro:', err);
      alert('Error al marcar cobro como cobrado');
    }
  };

  const handleAnular = async (cobroId) => {
    const cobro = cobros.find(c => c.id === cobroId);

    if (!cobro) {
      alert('❌ Cobro no encontrado');
      return;
    }

    const motivo = prompt('Ingrese el motivo de anulación:');
    if (!motivo) return;

    try {
      // Usar el endpoint correcto según el tipo de cobro
      if (cobro.tipo === 'EMPRESA') {
        const { anularCobroEmpresa } = await import('../services/cobrosEmpresaService');
        // Para cobros tipo EMPRESA, el id del cobro ES el cobroEmpresaId
        await anularCobroEmpresa(cobro.id, motivo, empresaSeleccionada.id);
        console.log('✅ Cobro empresa anulado:', cobro.id);
      } else {
        await anularCobro(cobroId, motivo, empresaSeleccionada.id);
        console.log('✅ Cobro obra anulado:', cobroId);
      }

      // 📡 Notificar al contexto centralizado
      eventBus.emit(FINANCIAL_EVENTS.COBRO_ELIMINADO, {
        presupuestoId: cobro.presupuestoNoClienteId,
        cobroId
      });

      if (onSuccess) {
        onSuccess({
          mensaje: '⚠️ Cobro anulado exitosamente'
        });
      }

      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else {
        cargarCobros();
      }
    } catch (err) {
      console.error('Error anulando cobro:', err);
      alert('Error al anular cobro');
    }
  };

  const handleEliminar = async (cobroId) => {
    const cobro = cobros.find(c => c.id === cobroId);

    if (!cobro) {
      alert('❌ Cobro no encontrado');
      return;
    }

    const confirmar = window.confirm('⚠️ ¿Está seguro de eliminar este cobro? Esta acción no se puede deshacer.');
    if (!confirmar) return;

    try {
      // 🔑 Usar el endpoint correcto según el tipo de cobro
      if (cobro.tipo === 'EMPRESA') {
        // Eliminar cobro empresa usando la API correcta
        const { eliminarCobroEmpresa } = await import('../services/cobrosEmpresaService');
        // Para cobros tipo EMPRESA, el id del cobro ES el cobroEmpresaId
        await eliminarCobroEmpresa(cobro.id, empresaSeleccionada.id);
        console.log('✅ Cobro empresa eliminado:', cobro.id);
      } else {
        // Eliminar cobro obra (API antigua)
        await eliminarCobro(cobroId, empresaSeleccionada.id);
        console.log('✅ Cobro obra eliminado:', cobroId);
      }

      // 📡 Notificar al contexto centralizado
      eventBus.emit(FINANCIAL_EVENTS.COBRO_ELIMINADO, {
        presupuestoId: cobro.presupuestoNoClienteId,
        cobroId
      });

      if (onSuccess) {
        onSuccess({
          mensaje: '🗑️ Cobro eliminado exitosamente'
        });
      }

      if (modoConsolidado) {
        cargarCobrosConsolidados();
      } else {
        cargarCobros();
      }
    } catch (err) {
      console.error('Error eliminando cobro:', err);

      // Mostrar mensaje específico del backend
      const mensaje = err?.response?.data?.message || err?.message || 'Error desconocido al eliminar el cobro';
      alert(`❌ Error al eliminar cobro:\n\n${mensaje}`);
    }
  };

  const cobrosFiltrados = cobros.filter(cobro => {
    if (filtroEstado === 'TODOS') return true;
    return cobro.estado?.toUpperCase() === filtroEstado;
  });

  // 📋 Agrupar cobros por obra para mejor UX en modo consolidado
  const agruparPorObra = (listaCobros) => {
    const grupos = {};
    listaCobros.forEach(cobro => {
      const nombreObra = cobro.nombreObra || 'Sin nombre';
      if (!grupos[nombreObra]) {
        grupos[nombreObra] = [];
      }
      grupos[nombreObra].push(cobro);
    });
    return grupos;
  };

  // 🎯 Renderizar información de ítems asignados al cobro
  const renderizarItemsAsignados = (cobro) => {
    const items = [];

    // Si es cobro de empresa, mostrar texto diferente
    if (cobro.tipo === 'EMPRESA') {
      return (
        <div>
          <span className="badge bg-info">💰 Cobro a Empresa</span>
          <div className="text-muted small mt-1">
            (Asignado a nivel obra, no por ítems)
          </div>
        </div>
      );
    }

    // Verificar si hay asignaciones (solo para cobros de obra)
    if (!cobro.asignaciones || cobro.asignaciones.length === 0) {
      return (
        <div>
          <span className="badge bg-secondary">💼 Sin asignación</span>
          <div className="text-muted small mt-1">
            (No distribuido por ítems)
          </div>
        </div>
      );
    }

    // Sumar montos de todas las asignaciones activas
    const totales = {
      profesionales: 0,
      materiales: 0,
      gastosGenerales: 0,
      trabajosExtra: 0
    };

    cobro.asignaciones
      .filter(a => a.estado === 'ACTIVA')
      .forEach(asig => {
        if (asig.montoProfesionales > 0) {
          totales.profesionales += parseFloat(asig.montoProfesionales);
        }
        if (asig.montoMateriales > 0) {
          totales.materiales += parseFloat(asig.montoMateriales);
        }
        if (asig.montoGastosGenerales > 0) {
          totales.gastosGenerales += parseFloat(asig.montoGastosGenerales);
        }
        if (asig.montoTrabajosExtra > 0) {
          totales.trabajosExtra += parseFloat(asig.montoTrabajosExtra);
        }
      });

    // Renderizar los totales
    if (totales.profesionales > 0) {
      items.push(
        <div key="prof" className="mb-1">
          <span className="badge bg-primary me-1">👷 Profesionales</span>
          <span className="text-primary fw-bold">{formatearMoneda(totales.profesionales)}</span>
        </div>
      );
    }
    if (totales.materiales > 0) {
      items.push(
        <div key="mat" className="mb-1">
          <span className="badge bg-warning text-dark me-1">🔧 Materiales</span>
          <span className="text-warning fw-bold">{formatearMoneda(totales.materiales)}</span>
        </div>
      );
    }
    if (totales.gastosGenerales > 0) {
      items.push(
        <div key="gg" className="mb-1">
          <span className="badge bg-success me-1">📋 Gastos Generales</span>
          <span className="text-success fw-bold">{formatearMoneda(totales.gastosGenerales)}</span>
        </div>
      );
    }
    if (totales.trabajosExtra > 0) {
      items.push(
        <div key="te" className="mb-1">
          <span className="badge bg-info text-white me-1">� Trabajos Extra</span>
          <span className="text-info fw-bold">{formatearMoneda(totales.trabajosExtra)}</span>
        </div>
      );
    }

    // Si no hay distribución por ítems, mostrar "General"
    if (items.length === 0) {
      return (
        <div>
          <span className="badge bg-info text-dark">💼 General</span>
          <div className="text-muted small mt-1">
            ({cobro.asignaciones.length} asignación(es) sin detalles)
          </div>
        </div>
      );
    }

    return <div className="small">{items}</div>;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog modal-xl" style={{marginTop: '40px', maxWidth: '1200px'}}>
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">💰 Cobros de Obra</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
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

            {/* Mostrar alerta en modo consolidado */}
            {modoConsolidado && (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                {haySeleccionParcial ? (
                  <><strong>Obras Seleccionadas:</strong> Mostrando cobros de {obrasSeleccionadas.size} obra(s) seleccionada(s)</>
                ) : (
                  <><strong>Modo Consolidado:</strong> Mostrando cobros de todas las obras</>
                )}
              </div>
            )}

            {/* Selector de dirección de obra - solo si NO está en modo consolidado */}
            {!modoConsolidado && (
              <DireccionObraSelector
                value={direccionSeleccionada}
                onChange={setDireccionSeleccionada}
                required={false}
                label="Seleccionar Dirección de la Obra"
                readOnly={!!obraDireccion}
              />
            )}

            {/* Información de la obra */}
            {(direccionSeleccionada || modoConsolidado) && (
              <>

                {/* Resumen financiero */}
                <div className="row mb-4">
                  <div className="col-md-4">
                    <div className="card border-success">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Cobrado</h6>
                        <h4 className="text-success mb-0">{formatearMoneda(totalCobrado)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card border-warning">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Pendiente</h6>
                        <h4 className="text-warning mb-0">{formatearMoneda(totalPendiente)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card border-primary">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Presupuesto</h6>
                        <h4 className="text-primary mb-0">{formatearMoneda(totalPresupuesto)}</h4>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtros */}
                <div className="mb-3">
                  <label className="form-label fw-bold">Filtrar por Estado:</label>
                  <div className="btn-group" role="group">
                    <button
                      className={`btn ${filtroEstado === 'TODOS' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFiltroEstado('TODOS')}
                    >
                      Todos ({cobros.length})
                    </button>
                    <button
                      className={`btn ${filtroEstado === 'PENDIENTE' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => setFiltroEstado('PENDIENTE')}
                    >
                      Pendientes ({cobros.filter(c => c.estado === 'PENDIENTE').length})
                    </button>
                    <button
                      className={`btn ${filtroEstado === 'COBRADO' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setFiltroEstado('COBRADO')}
                    >
                      Cobrados ({cobros.filter(c => c.estado === 'COBRADO').length})
                    </button>
                    <button
                      className={`btn ${filtroEstado === 'VENCIDO' ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => setFiltroEstado('VENCIDO')}
                    >
                      Vencidos ({cobros.filter(c => c.estado === 'VENCIDO' || estaVencido(c)).length})
                    </button>
                  </div>
                </div>

                {/* Tabla de cobros */}
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  </div>
                ) : cobrosFiltrados.length === 0 ? (
                  <div className="alert alert-info">
                    No hay cobros registrados{filtroEstado !== 'TODOS' ? ` en estado ${filtroEstado.toLowerCase()}` : ''}.
                  </div>
                ) : (
                  <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <table className="table table-hover table-bordered">
                      <thead className="table-light sticky-top">
                        <tr>
                          {modoConsolidado && <th>Obra</th>}
                          <th>Fecha Emisión</th>
                          <th>Descripción</th>
                          <th>Monto</th>
                          <th>Vencimiento</th>
                          <th>Método Pago</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modoConsolidado ? (
                          // Modo consolidado: Agrupar por obra
                          (() => {
                            const gruposObra = agruparPorObra(cobrosFiltrados);
                            return Object.entries(gruposObra).map(([nombreObra, cobrosObra]) => (
                              <React.Fragment key={nombreObra}>
                                {/* Cobros de esta obra */}
                                {cobrosObra.map(cobro => {
                                  const estadoInfo = obtenerEstadoCobro(cobro);
                                  const vencido = estaVencido(cobro);

                                  return (
                                    <tr key={cobro.id} className={vencido ? 'table-danger' : ''}>
                                      <td><small className="text-muted">↳</small></td>
                                      <td>{formatearFecha(cobro.fechaEmision)}</td>
                                      <td>
                                        {cobro.descripcion}
                                        {cobro.numeroComprobante && (
                                          <div className="text-muted small">
                                            N° {cobro.numeroComprobante}
                                          </div>
                                        )}
                                      </td>
                                      <td className="fw-bold">{formatearMoneda(cobro.monto)}</td>
                                      <td>
                                        {cobro.fechaVencimiento ? (
                                          <>
                                            {formatearFecha(cobro.fechaVencimiento)}
                                            {vencido && <div className="text-danger small">¡Vencido!</div>}
                                          </>
                                        ) : (
                                          <span className="text-muted">Sin vencimiento</span>
                                        )}
                                      </td>
                                      <td>{cobro.metodoPago || '-'}</td>
                                      <td>
                                        <span className={`badge bg-${estadoInfo.color}`}>
                                          {estadoInfo.icon} {estadoInfo.label}
                                        </span>
                                      </td>
                                      <td>
                                        <div className="btn-group btn-group-sm" role="group">
                                          {cobro.estado === 'PENDIENTE' && (
                                            <button
                                              className="btn btn-success"
                                              onClick={() => handleMarcarCobrado(cobro.id)}
                                              title="Marcar como cobrado"
                                            >
                                              ✓
                                            </button>
                                          )}
                                          {(cobro.estado?.toUpperCase() === 'PENDIENTE' || cobro.estado?.toUpperCase() === 'COBRADO') && (
                                            <button
                                              className="btn btn-warning"
                                              onClick={() => handleAnular(cobro.id)}
                                              title="Anular cobro"
                                            >
                                              ✗
                                            </button>
                                          )}
                                          <button
                                            className="btn btn-danger"
                                            onClick={() => handleEliminar(cobro.id)}
                                            title="Eliminar cobro"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ));
                          })()
                        ) : (
                          // Modo individual: Sin agrupación
                          cobrosFiltrados.map(cobro => {
                            const estadoInfo = obtenerEstadoCobro(cobro);
                            const vencido = estaVencido(cobro);

                            return (
                              <tr key={cobro.id} className={vencido ? 'table-danger' : ''}>
                                <td>{formatearFecha(cobro.fechaEmision)}</td>
                                <td>
                                  {cobro.descripcion}
                                  {cobro.numeroComprobante && (
                                    <div className="text-muted small">
                                      N° {cobro.numeroComprobante}
                                    </div>
                                  )}
                                </td>

                                <td className="fw-bold">{formatearMoneda(cobro.monto)}</td>
                                <td>
                                  {cobro.fechaVencimiento ? (
                                    <>
                                      {formatearFecha(cobro.fechaVencimiento)}
                                      {vencido && <div className="text-danger small">¡Vencido!</div>}
                                    </>
                                  ) : (
                                    <span className="text-muted">Sin vencimiento</span>
                                  )}
                                </td>
                                <td>{cobro.metodoPago || '-'}</td>
                                <td>
                                  <span className={`badge bg-${estadoInfo.color}`}>
                                    {estadoInfo.icon} {estadoInfo.label}
                                  </span>
                                </td>
                                <td>
                                  <div className="btn-group btn-group-sm" role="group">
                                    {cobro.estado === 'PENDIENTE' && (
                                      <button
                                        className="btn btn-success"
                                        onClick={() => handleMarcarCobrado(cobro.id)}
                                        title="Marcar como cobrado"
                                      >
                                        ✓
                                      </button>
                                    )}
                                    {(cobro.estado?.toUpperCase() === 'PENDIENTE' || cobro.estado?.toUpperCase() === 'COBRADO') && (
                                      <button
                                        className="btn btn-warning"
                                        onClick={() => handleAnular(cobro.id)}
                                        title="Anular cobro"
                                      >
                                        ✗
                                      </button>
                                    )}
                                    <button
                                      className="btn btn-danger"
                                      onClick={() => handleEliminar(cobro.id)}
                                      title="Eliminar cobro"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarCobrosObraModal;
