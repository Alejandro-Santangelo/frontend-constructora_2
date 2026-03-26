import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Alert, Table, Spinner, Accordion } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import apiService from '../services/api';

/**
 * Modal para Gestión Consolidada de Pagos a Gastos Generales
 * Estructura jerárquica: Obra → Rubro → Gastos Generales → Asignaciones
 * Filtra por las obras seleccionadas en Sistema Financiero
 */
const GestionPagosGastosGeneralesModal = ({
  show,
  onHide,
  onSuccess,
  empresaId, // 🔑 Recibir empresaId como prop explícita
  obrasSeleccionadas = new Set(), // 🆕 Obras seleccionadas para filtrar
  obrasDisponibles = [] // 🆕 Lista completa de obras con sus datos
}) => {
  const { empresaSeleccionada } = useEmpresa();
  // 🔑 Usar empresaId prop si existe, sino fallback al contexto
  const idEmpresaActual = empresaId || empresaSeleccionada?.id;

  // Estados principales
  const [gastosGenerales, setGastosGenerales] = useState([]);
  const [datosPorObra, setDatosPorObra] = useState([]); // 🆕 Datos reorganizados por obra
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para edición de campos
  const [editando, setEditando] = useState(null); // { asigId, campo }
  const [valorTemporal, setValorTemporal] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [campoAEditar, setCampoAEditar] = useState(null); // { asigId, campo, valorActual }

  // 💰 Estados para PAGO de Gastos Generales
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [gastoAPagar, setgastoAPagar] = useState(null); // { gastoNombre, asignacionId, presupuestoId, saldoPendiente, obraId, obraNombre }
  const [formPago, setFormPago] = useState({
    monto: '',
    metodoPago: 'EFECTIVO',
    fechaPago: new Date().toISOString().split('T')[0],
    concepto: '',
    observaciones: '',
    numeroComprobante: ''
  });
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState(null);
  
  // 💰 Estado para montos a pagar por gastoGeneral (key: asignacionId, value: monto)
  const [montosAPagar, setMontosAPagar] = useState({});

  // 💰 Estados para pools de dinero por rubro/obra
  const [poolsRubros, setPoolsRubros] = useState({}); // { 'obraId_rubroNombre': { total, asignado, disponible } }
  const [presupuestos, setPresupuestos] = useState([]); // Presupuestos de las obras
  const [editandoPool, setEditandoPool] = useState(null); // { poolKey }
  const [valorTemporalPool, setValorTemporalPool] = useState('');
  const [mostrarConfirmacionPool, setMostrarConfirmacionPool] = useState(false);
  const [poolAEditar, setPoolAEditar] = useState(null); // { poolKey, valorActual }

  // Cargar Gastos Generales y presupuestos cuando se abre el modal
  useEffect(() => {
    if (show && idEmpresaActual) {
      cargargastosGeneralesConsolidados();
      cargarPresupuestos();
    }
  }, [show, idEmpresaActual]); // 🔥 Ya no dependemos de props obrasSeleccionadas/obrasDisponibles

  // 💰 Recalcular pools cuando cambien Gastos Generales o presupuestos
  useEffect(() => {
    if (gastosGenerales.length > 0) {
      calcularPoolsIniciales(gastosGenerales);
    }
  }, [gastosGenerales, presupuestos]);

  // 🆕 Reorganizar datos por Obra → Rubro → Gastos Generales cuando cambien
  useEffect(() => {
    if (gastosGenerales.length > 0) {
      reorganizarDatosPorObra(gastosGenerales);
    }
  }, [gastosGenerales]); // 🔥 Solo depende de Gastos Generales

  const cargargastosGeneralesConsolidados = async () => {
    if (!idEmpresaActual) {
      console.warn('⚠️ No hay empresa seleccionada');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Cargando Gastos Generales consolidados para empresa:', idEmpresaActual);

      // 🔥 CARGAR OBRAS DIRECTAMENTE desde la API (igual que PagoConsolidadoModal)
      // No depender de props que pueden estar desactualizadas
      const [respAprobado, respEnEjecucion] = await Promise.all([
        apiService.presupuestosNoCliente.busquedaAvanzada({ estado: 'APROBADO' }, idEmpresaActual),
        apiService.presupuestosNoCliente.busquedaAvanzada({ estado: 'EN_EJECUCION' }, idEmpresaActual)
      ]);

      const extractData = (resp) => Array.isArray(resp) ? resp : (resp?.datos || resp?.content || resp?.data || []);
      const presupuestos = [...extractData(respAprobado), ...extractData(respEnEjecucion)];

      // Cargar datos completos de cada presupuesto (para obtener obraId)
      const presupuestosCompletos = await Promise.all(
        presupuestos.map(p => apiService.presupuestosNoCliente.getById(p.id, idEmpresaActual))
      );

      // Construir lista de obras (id del presupuesto, obraId de la obra)
      const obrasAConsultar = presupuestosCompletos.map(p => ({
        id: p.id,
        obraId: p.obraId || p.obra_id || p.direccionObraId,
        nombreObra: p.nombreObra || `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}`.trim(),
        estado: p.estado,
        direccion: `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}`.trim()
      })).filter(obra => obra.obraId); // Filtrar obras sin obraId

      console.log('🔍 Consultando gastos generales de', obrasAConsultar.length, 'obras activas (APROBADO, EN_EJECUCION)');

      // 🆕 Obtener Gastos Generales de cada obra en paralelo
      const promesas = obrasAConsultar.map(async (obra) => {
        try {
          // ✅ Usar obra.obraId (ID de la tabla obras) en lugar de obra.id (ID del presupuesto)
          const obraIdReal = obra.obraId || obra.id;
          console.log(`🔍 Consultando gastos generales de obra ${obraIdReal} (presupuesto ${obra.id}): ${obra.nombreObra}`);
          
          const response = await apiService.get(`/api/obras/${obraIdReal}/otros-costos`, {
            headers: { empresaId: idEmpresaActual }
          });
          const gastosGeneralesObra = Array.isArray(response) ? response : (response?.data || []);

          return {
            obraId: obraIdReal,
            presupuestoId: obra.id,
            obraNombre: obra.nombreObra || obra.nombre || obra.direccion,
            direccionCompleta: obra.direccion || obra.direccionCompleta,
            obraEstado: obra.estado,
            gastosGenerales: gastosGeneralesObra
          };
        } catch (err) {
          const obraIdReal = obra.obraId || obra.id;
          console.warn(`⚠️ Error cargando Gastos Generales de obra ${obraIdReal}:`, err.message);
          return {
            obraId: obraIdReal,
            presupuestoId: obra.id,
            obraNombre: obra.nombreObra || obra.nombre || obra.direccion,
            direccionCompleta: obra.direccion || obra.direccionCompleta,
            obraEstado: obra.estado,
            gastosGenerales: []
          };
        }
      });

      const resultados = await Promise.all(promesas);

      console.log(`✅ Se cargaron gastos generales de ${resultados.length} obras`);
      console.log('📊 Detalle por obra:', resultados.map(r => ({
        obra: r.obraNombre,
        cantidadgastosGenerales: r.gastosGenerales.length
      })));

      // 🆕 Convertir a formato consolidado: gastoGeneral → Obras
      const gastosGeneralesMap = {};

      resultados.forEach(({ obraId, presupuestoId, obraNombre, direccionCompleta, obraEstado, gastosGenerales }) => {
        gastosGenerales.forEach(gastoGeneral => {
          // 🔑 Identificador único del Gasto General
          const materialKey = gastoGeneral.presupuestoOtroCostoId
            || gastoGeneral.gastoGeneralId
            || `global_${gastoGeneral.descripcion}`;

          const nombregastoGeneral = gastoGeneral.nombreOtroCosto
            || gastoGeneral.descripcion
            || 'Gasto General sin nombre';

          const categoriagastoGeneral = gastoGeneral.categoria
            || 'Sin categoría';

          if (!gastosGeneralesMap[materialKey]) {
            gastosGeneralesMap[materialKey] = {
              gastoId: materialKey,
              gastoNombre: nombregastoGeneral,
              gastoTipo: categoriagastoGeneral,
              gastoGeneralId: gastoGeneral.gastoGeneralId || null,
              gastoDni: null,
              gastoTelefono: null,
              gastoEmail: null,
              obras: [],
              totalObras: 0,
              totalAsignaciones: 0,
              totalAsignado: 0,
              totalUtilizado: 0,
              saldoPendiente: 0
            };
          }

          // Agregar asignación a la obra correspondiente
          const gastoConsolidado = gastosGeneralesMap[materialKey];

          let obraExistente = gastoConsolidado.obras.find(o => o.obraId === obraId);
          if (!obraExistente) {
            obraExistente = {
              obraId,
              presupuestoId,
              obraNombre,
              direccionCompleta,
              obraEstado,
              asignaciones: [],
              totalAsignaciones: 0,
              totalAsignado: 0,
              totalUtilizado: 0,
              saldoPendiente: 0
            };
            gastoConsolidado.obras.push(obraExistente);
            gastoConsolidado.totalObras++;
          }

          // 🔢 Calcular totales - Gastos Generales usan importeAsignado directo, no precio × cantidad
          const importeAsignado = Number(gastoGeneral.importeAsignado || 0);
          const importeUtilizado = Number(gastoGeneral.importeUtilizado || 0);
          const saldoPendiente = importeAsignado - importeUtilizado;

          // 📝 Agregar asignación
          obraExistente.asignaciones.push({
            id: gastoGeneral.id,
            gastoGeneralCalculadoraId: gastoGeneral.presupuestoOtroCostoId || gastoGeneral.gastoGeneralId || null,
            rubroNombre: gastoGeneral.categoria || categoriagastoGeneral,
            tipoAsignacion: 'gastoGeneral',
            importeJornal: importeAsignado,
            cantidadJornales: 1, // Siempre 1 para gastos generales
            jornalesUtilizados: importeUtilizado > 0 ? 1 : 0,
            jornalesRestantes: importeUtilizado < importeAsignado ? 1 : 0,
            totalAsignado: importeAsignado,
            totalUtilizado: importeUtilizado,
            saldoPendiente,
            esSemanal: gastoGeneral.esSemanal || false,
            semana: gastoGeneral.semana || null,
            estado: gastoGeneral.estado || 'ACTIVO',
            fechaAsignacion: gastoGeneral.fechaAsignacion,
            observaciones: gastoGeneral.observaciones,
            unidadMedida: gastoGeneral.unidadMedida
          });

          obraExistente.totalAsignaciones++;
          obraExistente.totalAsignado += importeAsignado;
          obraExistente.totalUtilizado += importeUtilizado;
          obraExistente.saldoPendiente += saldoPendiente;

          gastoConsolidado.totalAsignaciones++;
          gastoConsolidado.totalAsignado += importeAsignado;
          gastoConsolidado.totalUtilizado += importeUtilizado;
          gastoConsolidado.saldoPendiente += saldoPendiente;
        });
      });

      const gastosGeneralesConsolidados = Object.values(gastosGeneralesMap);
      console.log(`✅ ${gastosGeneralesConsolidados.length} gastos generales consolidados`);

      if (gastosGeneralesConsolidados.length === 0) {
        console.warn('⚠️ No se encontraron Gastos Generales en ninguna obra');
        console.log('📊 Resultados por obra:', resultados);
      }

      if (gastosGeneralesConsolidados.length > 0) {
        console.log('📊 Primer gastoGeneral:', {
          nombre: gastosGeneralesConsolidados[0].gastoNombre,
          obras: gastosGeneralesConsolidados[0].totalObras,
          asignaciones: gastosGeneralesConsolidados[0].totalAsignaciones,
          totalAsignado: gastosGeneralesConsolidados[0].totalAsignado
        });
      }

      setGastosGenerales(gastosGeneralesConsolidados);
    } catch (err) {
      console.error('❌ Error al cargar gastos generales consolidados:', err);
      console.error('   Detalles:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Error al cargar información de pagos a Gastos Generales');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Reorganizar datos por Obra → Rubro → Gastos Generales
  const reorganizarDatosPorObra = (gastosGeneralesData) => {
    console.log('🔄 Reorganizando datos por obra...', {
      totalgastosGenerales: gastosGeneralesData.length,
      obrasSeleccionadas: Array.from(obrasSeleccionadas)
    });

    const obraMap = {};

    gastosGeneralesData.forEach(gastoGeneral => {
      gastoGeneral.obras.forEach(obra => {
        // ✅ NO FILTRAR - Ya cargamos solo obras APROBADO/EN_EJECUCION
        // El filtro anterior comparaba IDs de presupuesto vs IDs de obra (nunca coincidían)

        if (!obraMap[obra.obraId]) {
          obraMap[obra.obraId] = {
            obraId: obra.obraId,
            presupuestoId: obra.presupuestoId,
            obraNombre: obra.obraNombre,
            direccionCompleta: obra.direccionCompleta,
            obraEstado: obra.obraEstado,
            rubros: {}
          };
        }

        // Agrupar por rubro dentro de la obra
        obra.asignaciones.forEach(asig => {
          const rubroNombre = asig.rubroNombre || 'Sin rubro';

          if (!obraMap[obra.obraId].rubros[rubroNombre]) {
            obraMap[obra.obraId].rubros[rubroNombre] = {
              rubroNombre,
              gastosGenerales: [],
              totalAsignado: 0,
              totalUtilizado: 0,
              saldoPendiente: 0
            };
          }

          // Agregar gastoGeneral a este rubro
          obraMap[obra.obraId].rubros[rubroNombre].gastosGenerales.push({
            gastoId: gastoGeneral.gastoId,
            gastoNombre: gastoGeneral.gastoNombre,
            gastoTipo: gastoGeneral.gastoTipo,
            gastoDni: gastoGeneral.gastoDni,
            gastoTelefono: gastoGeneral.gastoTelefono,
            gastoEmail: gastoGeneral.gastoEmail,
            asignacion: asig
          });

          // Sumar totales del rubro
          obraMap[obra.obraId].rubros[rubroNombre].totalAsignado += Number(asig.totalAsignado || 0);
          obraMap[obra.obraId].rubros[rubroNombre].totalUtilizado += Number(asig.totalUtilizado || 0);
          obraMap[obra.obraId].rubros[rubroNombre].saldoPendiente += Number(asig.saldoPendiente || 0);
        });
      });
    });

    // Convertir a array y ordenar
    const obrasArray = Object.values(obraMap).map(obra => ({
      ...obra,
      rubrosArray: Object.values(obra.rubros).sort((a, b) =>
        a.rubroNombre.localeCompare(b.rubroNombre)
      )
    }));

    console.log('✅ Datos reorganizados:', {
      totalObras: obrasArray.length,
      primeraObra: obrasArray[0]?.obraNombre,
      rubrosEnPrimeraObra: obrasArray[0]?.rubrosArray.length
    });

    setDatosPorObra(obrasArray);
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
      setPresupuestos(lista);
      console.log('Presupuestos cargados:', lista.length);
    } catch (err) {
      console.warn('No se pudieron cargar presupuestos:', err.message);
    }
  };

  // 💰 Calcular pools iniciales de rubros por obra
  const calcularPoolsIniciales = (gastosGeneralesData) => {
    const pools = {};

    gastosGeneralesData.forEach(prof => {
      prof.obras.forEach(obra => {
        obra.asignaciones.forEach(asig => {
          const poolKey = `${obra.obraId}_${asig.rubroNombre}`;

          if (!pools[poolKey]) {
            pools[poolKey] = {
              obraId: obra.obraId,
              obraNombre: obra.obraNombre,
              rubroNombre: asig.rubroNombre,
              importeTotal: 0, // Se cargará desde presupuesto
              importeAsignado: 0,
              importeDisponible: 0
            };
          }

          // Sumar lo ya asignado a Gastos Generales
          pools[poolKey].importeAsignado += Number(asig.totalAsignado || 0);
        });
      });
    });

    // 💰 Intentar cargar totales desde presupuestos
    if (presupuestos && presupuestos.length > 0) {
      presupuestos.forEach(presupuesto => {
        // Buscar itemsCalculadoraJson (modo global/detallado)
        const items = presupuesto.itemsCalculadoraJson || [];

        items.forEach(item => {
          const rubroNombre = item.tipogastoGeneral || item.rubroNombre || 'Sin rubro';
          const obraId = presupuesto.obraId || presupuesto.obra_id;

          if (!obraId) return;

          const poolKey = `${obraId}_${rubroNombre}`;

          if (pools[poolKey]) {
            // Si es modo global, usar subtotalJornales
            // Si es detallado, sumar jornales individuales
            const totalJornales = item.subtotalJornales ||
                                 (item.jornales?.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0)) ||
                                 0;

            pools[poolKey].importeTotal += totalJornales;
          }
        });
      });
    }

    // Calcular disponible
    Object.keys(pools).forEach(key => {
      pools[key].importeDisponible = pools[key].importeTotal - pools[key].importeAsignado;
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

  // 💰 Actualizar pool cuando se asigna dinero a un gastoGeneral
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
    setPoolAEditar({ poolKey, valorActual });
    setMostrarConfirmacionPool(true);
  };

  // 💰 Confirmar edición del pool
  const confirmarEdicionPool = () => {
    setEditandoPool({ poolKey: poolAEditar.poolKey });
    setValorTemporalPool(poolAEditar.valorActual);
    setMostrarConfirmacionPool(false);
  };

  // 💰 Cancelar edición del pool
  const cancelarEdicionPool = () => {
    setPoolAEditar(null);
    setMostrarConfirmacionPool(false);
    setEditandoPool(null);
    setValorTemporalPool('');
  };

  // 💰 Guardar cambio del total del pool
  const guardarCambioPool = (poolKey, nuevoTotal) => {
    setPoolsRubros(prev => {
      const pool = prev[poolKey];
      if (!pool) return prev;

      const nuevoDisponible = Number(nuevoTotal) - pool.importeAsignado;

      return {
        ...prev,
        [poolKey]: {
          ...pool,
          importeTotal: Number(nuevoTotal),
          importeDisponible: nuevoDisponible
        }
      };
    });

    setEditandoPool(null);
    setValorTemporalPool('');
  };

  const formatearMoneda = (valor) => {
    if (!valor && valor !== 0) return '$0.00';
    return `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBadgeEstado = (estado) => {
    const badges = {
      'ACTIVO': 'success',
      'FINALIZADO': 'secondary',
      'CANCELADO': 'danger'
    };
    return badges[estado] || 'secondary';
  };

  const calcularTotalesGenerales = () => {
    // 🆕 Calcular desde datos reorganizados por obra
    let totalGastosGenerales = new Set();
    let totalObras = datosPorObra.length;
    let totalRubros = 0;
    let totalAsignaciones = 0;
    let totalAsignado = 0;
    let totalUtilizado = 0;
    let totalPendiente = 0;

    datosPorObra.forEach(obra => {
      totalRubros += obra.rubrosArray.length;
      obra.rubrosArray.forEach(rubro => {
        totalAsignaciones += rubro.gastosGenerales.length;
        totalAsignado += rubro.totalAsignado;
        totalUtilizado += rubro.totalUtilizado;
        totalPendiente += rubro.saldoPendiente;

        // Contar Gastos Generales únicos
        rubro.gastosGenerales.forEach(mat => {
          totalGastosGenerales.add(mat.gastoId);
        });
      });
    });

    return {
      totalgastosGenerales: totalGastosGenerales.size,
      totalObras,
      totalRubros,
      totalAsignaciones,
      totalAsignado,
      totalUtilizado,
      totalPendiente
    };
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

  // 💰 Actualizar monto a pagar de un gastoGeneral
  const actualizarMontoAPagarGasto = (asignacionId, monto, saldoPendiente) => {
    const montoNumerico = Number(monto);
    
    // Validar que no supere el saldo pendiente
    if (montoNumerico > saldoPendiente) {
      setMontosAPagar(prev => ({ ...prev, [asignacionId]: saldoPendiente }));
      return;
    }
    
    // Validar que no sea negativo
    if (montoNumerico < 0) {
      setMontosAPagar(prev => ({ ...prev, [asignacionId]: 0 }));
      return;
    }
    
    setMontosAPagar(prev => ({ ...prev, [asignacionId]: montoNumerico }));
  };

  // 💰 Abrir modal de pago con monto pre-cargado desde input
  const abrirModalPago = (gastoGeneral, asignacion, obraId, obraNombre, presupuestoId) => {
    // Usar el monto ingresado en el input o el saldo pendiente completo
    const montoPreCargado = montosAPagar[asignacion.id] || asignacion.saldoPendiente || 0;
    
    setgastoAPagar({
      gastoNombre: gastoGeneral.gastoNombre,
      gastoGeneralCalculadoraId: asignacion.gastoGeneralCalculadoraId || null,
      gastoGeneralId: gastoGeneral.gastoGeneralId || null,
      asignacionId: asignacion.id,
      presupuestoId: presupuestoId,
      saldoPendiente: asignacion.saldoPendiente,
      obraId: obraId,
      obraNombre: obraNombre,
      rubroNombre: asignacion.rubroNombre
    });
    setFormPago({
      monto: montoPreCargado,
      metodoPago: 'EFECTIVO',
      fechaPago: new Date().toISOString().split('T')[0],
      concepto: `Pago por Gasto General: ${gastoGeneral.gastoNombre}`,
      observaciones: '',
      numeroComprobante: ''
    });
    setMostrarModalPago(true);
    setErrorPago(null);
  };

  // 💰 Cerrar modal de pago
  const cerrarModalPago = () => {
    setMostrarModalPago(false);
    setgastoAPagar(null);
    setFormPago({
      monto: '',
      metodoPago: 'EFECTIVO',
      fechaPago: new Date().toISOString().split('T')[0],
      concepto: '',
      observaciones: '',
      numeroComprobante: ''
    });
    setErrorPago(null);
  };

  // 💰 Registrar pago de gastoGeneral
  const registrarPago = async () => {
    if (!gastoAPagar) return;

    // Validaciones
    if (!formPago.monto || Number(formPago.monto) <= 0) {
      setErrorPago('El monto debe ser mayor a 0');
      return;
    }

    if (Number(formPago.monto) > gastoAPagar.saldoPendiente) {
      setErrorPago(`El monto no puede ser mayor al saldo pendiente (${formatearMoneda(gastoAPagar.saldoPendiente)})`);
      return;
    }

    if (!formPago.metodoPago) {
      setErrorPago('Debe seleccionar un método de pago');
      return;
    }

    if (!formPago.fechaPago) {
      setErrorPago('Debe seleccionar una fecha de pago');
      return;
    }

    setProcesandoPago(true);
    setErrorPago(null);

    try {
      const requestBody = {
        presupuestoNoClienteId: gastoAPagar.presupuestoId,
        gastoGeneralCalculadoraId: gastoAPagar.gastoGeneralCalculadoraId,
        gastoGeneralId: gastoAPagar.gastoGeneralId || null,
        tipoPago: 'GASTOS_GENERALES',
        concepto: formPago.concepto || `Pago por Gasto General: ${gastoAPagar.gastoNombre}`,
        monto: Number(formPago.monto),
        metodoPago: formPago.metodoPago,
        fechaPago: formPago.fechaPago,
        estado: 'PAGADO',
        observaciones: formPago.observaciones || null,
        numeroComprobante: formPago.numeroComprobante || null,
        empresaId: idEmpresaActual
      };

      console.log('🔍 Registrando pago de Gasto General:', requestBody);

      const response = await apiService.post(
        '/api/v1/pagos-consolidados',
        requestBody,
        { headers: { empresaId: idEmpresaActual } }
      );

      console.log('✅ Pago registrado exitosamente:', response);

      // Recargar datos
      await cargargastosGeneralesConsolidados();

      // Limpiar el monto a pagar de este gastoGeneral
      setMontosAPagar(prev => {
        const nuevo = { ...prev };
        delete nuevo[gastoAPagar.asignacionId];
        return nuevo;
      });
      
      // Cerrar modal
      cerrarModalPago();

      // Notificar éxito
      if (onSuccess) onSuccess();

      // Mostrar mensaje de éxito al usuario
      alert(`✅ Pago de ${formatearMoneda(formPago.monto)} registrado exitosamente para ${gastoAPagar.gastoNombre}`);

    } catch (err) {
      console.error('❌ Error al registrar pago:', err);
      const mensajeError = err.response?.data?.message || err.message || 'Error al registrar el pago';
      setErrorPago(mensajeError);
    } finally {
      setProcesandoPago(false);
    }
  };

  // Guardar cambio
  const guardarCambio = async (asigId, campo, nuevoValor) => {
    try {
      // Aquí llamarías al endpoint para actualizar la asignación
      // Ejemplo: await apiService.put(`/api/Gastos Generales-obras/${asigId}`, { [campo]: nuevoValor }, { empresaId: empresaSeleccionada.id });

      // 💰 Capturar datos antes de la actualización para ajustar el pool
      let obraIdParaPool = null;
      let rubroNombreParaPool = null;
      let totalAsignadoAnterior = 0;
      let totalAsignadoNuevo = 0;

      // Por ahora, actualizar localmente
      const nuevosGastosGenerales = gastosGenerales.map(prof => ({
        ...prof,
        obras: prof.obras.map(obra => ({
          ...obra,
          asignaciones: obra.asignaciones.map(asig => {
            if (asig.id === asigId) {
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

      setGastosGenerales(nuevosGastosGenerales);

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

  // 🆕 Renderizar tabla de Gastos Generales por rubro
  const renderGastosGeneralesTable = (gastosGenerales, rubroNombre, obraId, obraNombre, presupuestoId) => {
    if (!gastosGenerales || gastosGenerales.length === 0) {
      return (
        <Alert variant="info" className="mb-0 text-center">
          No hay Gastos Generales asignados a este rubro
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive size="sm" className="mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: '22%' }}>gastoGeneral</th>
            <th style={{ width: '8%' }} className="text-center">Tipo</th>
            <th style={{ width: '10%' }} className="text-end">Precio</th>
            <th style={{ width: '10%' }} className="text-center">Cantidad</th>
            <th style={{ width: '12%' }} className="text-end">Total a Pagar</th>
            <th style={{ width: '12%' }} className="text-end">Importe a Pagar</th>
            <th style={{ width: '12%' }} className="text-end">Total Utilizado</th>
            <th style={{ width: '12%' }} className="text-end">Saldo Pendiente</th>
            <th style={{ width: '8%' }} className="text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {gastosGenerales.map((mat, idx) => {
            const asig = mat.asignacion;
            const montoAPagar = montosAPagar[asig.id] || '';
            const saldoPendienteActual = Number(asig.saldoPendiente || 0);
            const tieneSaldo = saldoPendienteActual > 0;
            
            return (
              <tr key={idx}>
                <td>
                  <strong className="text-primary">{mat.gastoNombre}</strong>
                  {mat.gastoTipo && (
                    <div className="mt-1">
                      <Badge bg="info" className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                        {mat.gastoTipo}
                      </Badge>
                    </div>
                  )}
                </td>
                <td className="text-center">
                  <Badge bg={asig.tipoAsignacion === 'JORNAL' ? 'primary' : 'info'} className="text-uppercase">
                    {asig.tipoAsignacion || '-'}
                  </Badge>
                </td>
                <td className="text-end">
                  <CampoEditable asigId={asig.id} campo="importeJornal" valor={asig.importeJornal} esMoneda={true} />
                </td>
                <td className="text-center">
                  <div>
                    <span className="text-success fw-bold">{asig.jornalesUtilizados || 0}</span>
                    <span className="text-muted"> / </span>
                    <CampoEditable asigId={asig.id} campo="cantidadJornales" valor={asig.cantidadJornales} />
                  </div>
                  <small className="text-muted">
                    ({asig.jornalesRestantes || 0} rest.)
                  </small>
                </td>
                <td className="text-end">
                  <span className="fw-bold text-primary">{formatearMoneda(asig.totalAsignado)}</span>
                </td>
                <td className="text-end">
                  {tieneSaldo && asig.estado === 'ACTIVO' ? (
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      style={{ minWidth: '100px' }}
                      value={montoAPagar}
                      onChange={(e) => actualizarMontoAPagarGasto(asig.id, e.target.value, saldoPendienteActual)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      max={saldoPendienteActual}
                    />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                  {montoAPagar > 0 && (
                    <small className="text-success d-block mt-1">
                      {formatearMoneda(montoAPagar)}
                    </small>
                  )}
                </td>
                <td className="text-end">
                  <span className="fw-bold text-warning">{formatearMoneda(asig.totalUtilizado)}</span>
                </td>
                <td className="text-end">
                  <span className={`fw-bold ${saldoPendienteActual > 0 ? 'text-danger' : 'text-success'}`}>
                    {formatearMoneda(asig.saldoPendiente)}
                  </span>
                </td>
                <td className="text-center">
                  {tieneSaldo && asig.estado === 'ACTIVO' && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => abrirModalPago(mat, asig, obraId, obraNombre, presupuestoId)}
                      title="Registrar pago"
                      disabled={!montoAPagar || montoAPagar <= 0}
                    >
                      <i className="bi bi-cash-coin me-1"></i>
                      Pagar
                    </Button>
                  )}
                  {!tieneSaldo && (
                    <Badge bg="success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}>
                      <i className="bi bi-check-circle me-1"></i>
                      Pagado
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  // 🆕 Renderizar rubros de una obra
  const renderRubrosDeObra = (rubrosArray, obraId, obraNombre, presupuestoId) => {
    if (!rubrosArray || rubrosArray.length === 0) {
      return (
        <Alert variant="warning" className="mb-0">
          <i className="bi bi-info-circle me-2"></i>
          Esta obra no tiene rubros con Gastos Generales asignados
        </Alert>
      );
    }

    return (
      <Accordion defaultActiveKey="0" className="rubros-accordion">
        {rubrosArray.map((rubro, idxRubro) => {
          const pool = obtenerPoolDisponible(obraId, rubro.rubroNombre);
          const poolKey = `${obraId}_${rubro.rubroNombre}`;
          const estaEditandoPool = editandoPool?.poolKey === poolKey;

          return (
            <Accordion.Item eventKey={String(idxRubro)} key={idxRubro} className="mb-2">
              <Accordion.Header>
                <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                  <div>
                    <strong className="text-info fs-6">
                      <i className="bi bi-tag-fill me-2"></i>
                      {rubro.rubroNombre}
                    </strong>
                    <div className="mt-1">
                      <small className="text-muted">
                        <i className="bi bi-people me-1"></i>
                        {rubro.gastosGenerales.length} gastoGeneral{rubro.gastosGenerales.length !== 1 ? 'es' : ''}
                      </small>
                    </div>
                  </div>
                  <div className="d-flex gap-3 align-items-center">
                    {/* 💰 Pool del rubro */}
                    <div className="badge bg-info bg-opacity-75 text-dark" style={{ fontSize: '0.85rem', padding: '0.5rem 0.7rem' }}>
                      <span className="me-2"><strong>Disponible:</strong></span>
                      {estaEditandoPool ? (
                        <input
                          type="number"
                          className="form-control form-control-sm d-inline-block"
                          style={{ width: '100px', fontSize: '0.8rem' }}
                          value={valorTemporalPool}
                          onChange={(e) => setValorTemporalPool(e.target.value)}
                          onBlur={() => {
                            if (valorTemporalPool !== String(pool.total)) {
                              guardarCambioPool(poolKey, valorTemporalPool);
                            } else {
                              cancelarEdicionPool();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              guardarCambioPool(poolKey, valorTemporalPool);
                            } else if (e.key === 'Escape') {
                              cancelarEdicionPool();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            solicitarEdicionPool(obraId, rubro.rubroNombre, pool.total);
                          }}
                          style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                          title="Click para editar el total del presupuesto"
                        >
                          {formatearMoneda(pool.disponible)}
                        </span>
                      )}
                      <small className="text-muted ms-1">(de {formatearMoneda(pool.total)})</small>
                    </div>
                    <div className="text-center">
                      <div className="fw-bold text-success">{formatearMoneda(rubro.totalAsignado)}</div>
                      <small className="text-muted">Total</small>
                    </div>
                    <div className="text-center">
                      <div className="fw-bold text-warning">{formatearMoneda(rubro.totalUtilizado)}</div>
                      <small className="text-muted">Utilizado</small>
                    </div>
                    <div className="text-center">
                      <div className="fw-bold text-danger">{formatearMoneda(rubro.saldoPendiente)}</div>
                      <small className="text-muted">Pendiente</small>
                    </div>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-white">
                {renderGastosGeneralesTable(rubro.gastosGenerales, rubro.rubroNombre, obraId, obraNombre, presupuestoId)}
              </Accordion.Body>
            </Accordion.Item>
          );
        })}
      </Accordion>
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
      className="modal-gestion-pagos-gastos-generales"
    >
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>
          <i className="bi bi-cash-stack me-2"></i>
          Gestión de Pagos por Gasto General / Otro Costo
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

        {/* Loading */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Cargando informaciÃ³n de pagos...</p>
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
                      Resumen General
                    </h6>
                    <div className="row text-center">
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-primary">{totalesGenerales.totalGastosGenerales}</h5>
                          <small className="text-muted">Gastos Generales</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-info">{totalesGenerales.totalObras}</h5>
                          <small className="text-muted">Obras</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-secondary">{totalesGenerales.totalRubros}</h5>
                          <small className="text-muted">Rubros</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-secondary">{totalesGenerales.totalAsignaciones}</h5>
                          <small className="text-muted">Asignaciones</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-success bg-opacity-10">
                          <h6 className="mb-1 text-success">{formatearMoneda(totalesGenerales.totalAsignado)}</h6>
                          <small className="text-muted">Asignado</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-warning bg-opacity-10">
                          <h6 className="mb-1 text-warning">{formatearMoneda(totalesGenerales.totalUtilizado)}</h6>
                          <small className="text-muted">Utilizado</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-danger bg-opacity-10">
                          <h6 className="mb-1 text-danger">{formatearMoneda(totalesGenerales.totalPendiente)}</h6>
                          <small className="text-muted">Pendiente</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Listado de Obras con Acordeón */}
            {datosPorObra.length === 0 ? (
              <Alert variant="info" className="text-center">
                <i className="bi bi-info-circle me-2"></i>
                {obrasSeleccionadas.size > 0
                  ? 'No hay Gastos Generales asignados a las obras seleccionadas'
                  : 'No hay Gastos Generales con asignaciones activas'}
              </Alert>
            ) : (
              <Accordion defaultActiveKey="0">
                {datosPorObra.map((obra, idx) => {
                  // Calcular totales de la obra
                  const totalAsignadoObra = obra.rubrosArray.reduce((sum, r) => sum + r.totalAsignado, 0);
                  const totalUtilizadoObra = obra.rubrosArray.reduce((sum, r) => sum + r.totalUtilizado, 0);
                  const totalPendienteObra = obra.rubrosArray.reduce((sum, r) => sum + r.saldoPendiente, 0);
                  const totalgastosGeneralesObra = obra.rubrosArray.reduce((sum, r) => sum + r.gastosGenerales.length, 0);

                  return (
                    <Accordion.Item eventKey={String(idx)} key={idx}>
                      <Accordion.Header>
                        <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                          <div>
                            <strong className="text-primary fs-5">
                              <i className="bi bi-building me-2"></i>
                              {obra.obraNombre || `Obra ${idx + 1}`}
                            </strong>
                            {obra.direccionCompleta && (
                              <div className="mt-1">
                                <small className="text-muted">
                                  <i className="bi bi-geo-alt-fill me-1"></i>
                                  {obra.direccionCompleta}
                                </small>
                              </div>
                            )}
                            <div className="mt-1">
                              <Badge bg="secondary" className="me-2">{obra.obraEstado || 'N/A'}</Badge>
                              <small className="text-muted me-3">
                                <i className="bi bi-tag me-1"></i>
                                {obra.rubrosArray.length} rubro{obra.rubrosArray.length !== 1 ? 's' : ''}
                              </small>
                              <small className="text-muted">
                                <i className="bi bi-people me-1"></i>
                                {totalgastosGeneralesObra} gastoGeneral{totalgastosGeneralesObra !== 1 ? 'es' : ''}
                              </small>
                            </div>
                          </div>
                          <div className="d-flex gap-3 align-items-center">
                            <div className="text-center">
                              <div className="fw-bold text-success">{formatearMoneda(totalAsignadoObra)}</div>
                              <small className="text-muted">Asignado</small>
                            </div>
                            <div className="text-center">
                              <div className="fw-bold text-warning">{formatearMoneda(totalUtilizadoObra)}</div>
                              <small className="text-muted">Utilizado</small>
                            </div>
                            <div className="text-center">
                              <div className="fw-bold text-danger">{formatearMoneda(totalPendienteObra)}</div>
                              <small className="text-muted">Pendiente</small>
                            </div>
                          </div>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body className="bg-light">
                        {renderRubrosDeObra(obra.rubrosArray, obra.obraId, obra.obraNombre, obra.presupuestoId)}
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light">
        <Button variant="secondary" onClick={onHide}>
          <i className="bi bi-x-circle me-2"></i>
          Cerrar
        </Button>
        <Button variant="primary" onClick={cargargastosGeneralesConsolidados}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Actualizar
        </Button>
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
          <strong>Importante:</strong> Este cambio afectará el saldo disponible para asignar a los Gastos Generales de este rubro en esta obra.
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

    {/* 💰 Modal de Pago */}
    <Modal show={mostrarModalPago} onHide={cerrarModalPago} centered size="lg">
      <Modal.Header closeButton className="bg-success text-white">
        <Modal.Title>
          <i className="bi bi-cash-coin me-2"></i>
          Registrar Pago de gastoGeneral
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {gastoAPagar && (
          <>
            {/* Información del gastoGeneral */}
            <div className="card bg-light mb-3">
              <div className="card-body">
                <h6 className="card-title text-primary mb-3">
                  <i className="bi bi-receipt me-2"></i>
                  Información del gastoGeneral
                </h6>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>gastoGeneral:</strong> {gastoAPagar.gastoNombre}
                    </p>
                    <p className="mb-2">
                      <strong>Obra:</strong> {gastoAPagar.obraNombre}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Rubro:</strong> {gastoAPagar.rubroNombre}
                    </p>
                    <p className="mb-0">
                      <strong>Saldo Pendiente:</strong>{' '}
                      <span className="text-danger fw-bold">
                        {formatearMoneda(gastoAPagar.saldoPendiente)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {errorPago && (
              <Alert variant="danger" className="mb-3" onClose={() => setErrorPago(null)} dismissible>
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {errorPago}
              </Alert>
            )}

            {/* Formulario de Pago */}
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-currency-dollar me-1"></i>
                  Monto a Pagar *
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formPago.monto}
                  onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={gastoAPagar.saldoPendiente}
                />
                <small className="text-muted">
                  Máximo: {formatearMoneda(gastoAPagar.saldoPendiente)}
                </small>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-credit-card me-1"></i>
                  Método de Pago *
                </label>
                <select
                  className="form-select"
                  value={formPago.metodoPago}
                  onChange={(e) => setFormPago({ ...formPago, metodoPago: e.target.value })}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="DEBITO">Débito</option>
                  <option value="CREDITO">Crédito</option>
                </select>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-calendar-event me-1"></i>
                  Fecha de Pago *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formPago.fechaPago}
                  onChange={(e) => setFormPago({ ...formPago, fechaPago: e.target.value })}
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-receipt me-1"></i>
                  Número de Comprobante
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formPago.numeroComprobante}
                  onChange={(e) => setFormPago({ ...formPago, numeroComprobante: e.target.value })}
                  placeholder="Ej: 001-00123456"
                />
              </div>

              <div className="col-md-12 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-file-text me-1"></i>
                  Concepto *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formPago.concepto}
                  onChange={(e) => setFormPago({ ...formPago, concepto: e.target.value })}
                  placeholder="Ej: Pago parcial por cemento"
                />
              </div>

              <div className="col-md-12 mb-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-chat-left-text me-1"></i>
                  Observaciones
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formPago.observaciones}
                  onChange={(e) => setFormPago({ ...formPago, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={cerrarModalPago} disabled={procesandoPago}>
          <i className="bi bi-x-circle me-2"></i>
          Cancelar
        </Button>
        <Button
          variant="success"
          onClick={registrarPago}
          disabled={procesandoPago || !formPago.monto || !formPago.metodoPago || !formPago.fechaPago}
        >
          {procesandoPago ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Procesando...
            </>
          ) : (
            <>
              <i className="bi bi-check-circle me-2"></i>
              Registrar Pago
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
};

export default GestionPagosGastosGeneralesModal;
