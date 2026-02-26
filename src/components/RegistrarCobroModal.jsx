import React, { useState, useEffect } from 'react';
import { registrarCobro, formatearMoneda, formatearFecha, listarCobrosPorObra } from '../services/cobrosObraService';
import { registrarCobroEmpresa, asignarCobroAObras } from '../services/cobrosEmpresaService';
import { crearAsignacionConDistribucion } from '../services/asignacionesCobroObraService';
import { obtenerSaldoDisponible } from '../services/retirosPersonalesService';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import DireccionObraSelector from './DireccionObraSelector';
import RegistrarRetiroModal from './RegistrarRetiroModal';
import ListarRetirosModal from './ListarRetirosModal';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

const RegistrarCobroModal = ({ show, onHide, onSuccess, obraId, obraDireccion }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [formData, setFormData] = useState({
    montoTotal: '', // Monto total recibido
    descripcion: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaVencimiento: '',
    metodoPago: 'TRANSFERENCIA',
    numeroComprobante: '',
    observaciones: ''
  });
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [distribucion, setDistribucion] = useState([]); // [{obraId, monto, porcentaje}]
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState([]); // 🆕 Array de presupuestoNoClienteId seleccionados
  const [tipoDistribucion, setTipoDistribucion] = useState('MONTO'); // 'MONTO' o 'PORCENTAJE'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalesPorObra, setTotalesPorObra] = useState({}); // {obraId: {presupuesto, cobrado, pendiente}}
  const [successMessage, setSuccessMessage] = useState(null);

  // 🆕 Estados para distribución por ítems POR CADA OBRA
  const [distribucionPorObra, setDistribucionPorObra] = useState({}); // {obraId: {profesionales: {monto, porcentaje}, materiales: {}, gastosGenerales: {}}}
  const [tipoDistribucionPorObra, setTipoDistribucionPorObra] = useState({}); // {obraId: 'MONTO' | 'PORCENTAJE'}
  const [obrasExpandidas, setObrasExpandidas] = useState([]); // Array de obraIds expandidos

  // 🆕 Estados para distribución por ítems (Profesionales, Materiales, Gastos Generales, Trabajos Extra)
  const [modoDistribucion, setModoDistribucion] = useState('GENERAL'); // 'GENERAL' o 'POR_ITEMS'
  const [distribucionItems, setDistribucionItems] = useState({
    profesionales: { monto: 0, porcentaje: 0 },
    materiales: { monto: 0, porcentaje: 0 },
    gastosGenerales: { monto: 0, porcentaje: 0 },
    trabajosExtra: { monto: 0, porcentaje: 0 } // 🔧 NUEVO
  });
  const [tipoDistribucionItems, setTipoDistribucionItems] = useState('MONTO'); // 'MONTO' o 'PORCENTAJE'

  // 🔧 Estados para trabajos extra
  const [trabajosExtraDisponibles, setTrabajosExtraDisponibles] = useState([]);
  const [cargandoTrabajosExtra, setCargandoTrabajosExtra] = useState(false);

  // 🆕 Estados para mostrar último cobro
  const [vistaActual, setVistaActual] = useState('resumen-cobros'); // 'resumen-cobros' | 'nuevo-cobro' | 'asignar-existente'
  const [cobrosNoAsignados, setCobrosNoAsignados] = useState([]);
  const [cobroSeleccionado, setCobroSeleccionado] = useState(null); // 🆕 Cobro a asignar en modo asignar-existente
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [totalesGlobales, setTotalesGlobales] = useState({
    totalCobrado: 0,
    totalAsignado: 0,
    totalRetirado: 0,
    totalDisponible: 0,
    cantidadCobros: 0
  });

  // 🆕 Estados para modales de retiros
  const [mostrarRegistrarRetiro, setMostrarRegistrarRetiro] = useState(false);
  const [mostrarListarRetiros, setMostrarListarRetiros] = useState(false);

  // Determinar si es modo INDIVIDUAL (obra pre-seleccionada)
  const modoIndividual = !!obraDireccion;

  // Auto-actualización cuando el modal se abre
  useEffect(() => {
    if (show && empresaSeleccionada) {
      console.log('🔄 RegistrarCobro: Modo individual:', modoIndividual);

      // Solo cargar obras si NO viene pre-seleccionada
      if (!modoIndividual) {
        console.log('🔄 RegistrarCobro: Cargando obras disponibles...');
        cargarObrasDisponibles();
      }

      // Reset form
      setFormData({
        montoTotal: '',
        descripcion: '',
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
        metodoPago: 'TRANSFERENCIA',
        numeroComprobante: '',
        observaciones: ''
      });
      setDistribucion([]);
      setObrasSeleccionadas([]); // 🆕 Reset obras seleccionadas
      setDistribucionPorObra({}); // 🆕 Reset distribución por obra
      setTipoDistribucionPorObra({}); // 🆕 Reset tipo de distribución por obra
      setObrasExpandidas([]); // 🆕 Reset obras expandidas
      setTipoDistribucion('MONTO');
      setError(null);
      setSuccessMessage(null);

      // Reset distribución por ítems
      setModoDistribucion('GENERAL');
      setDistribucionItems({
        profesionales: { monto: 0, porcentaje: 0 },
        materiales: { monto: 0, porcentaje: 0 },
        gastosGenerales: { monto: 0, porcentaje: 0 },
        trabajosExtra: { monto: 0, porcentaje: 0 } // 🔧 NUEVO
      });
      setTipoDistribucionItems('MONTO');
      setTrabajosExtraDisponibles([]);
    }
  }, [show, empresaSeleccionada, modoIndividual]);

  // 🆕 Cargar resumen de cobros al abrir el modal
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarResumenCobros();
    }
  }, [show, empresaSeleccionada]);

  // 🆕 Escuchar eventos de retiros para actualizar saldo
  useEffect(() => {
    if (!show || !empresaSeleccionada) return;

    const unsubscribeRetiroRegistrado = eventBus.on(FINANCIAL_EVENTS.RETIRO_REGISTRADO, () => {
      console.log('📡 Evento recibido: RETIRO_REGISTRADO - Recargando saldo...');
      cargarResumenCobros();
    });

    const unsubscribeRetiroAnulado = eventBus.on(FINANCIAL_EVENTS.RETIRO_ANULADO, () => {
      console.log('📡 Evento recibido: RETIRO_ANULADO - Recargando saldo...');
      cargarResumenCobros();
    });

    const unsubscribeRetiroEliminado = eventBus.on(FINANCIAL_EVENTS.RETIRO_ELIMINADO, () => {
      console.log('📡 Evento recibido: RETIRO_ELIMINADO - Recargando saldo...');
      cargarResumenCobros();
    });

    return () => {
      unsubscribeRetiroRegistrado();
      unsubscribeRetiroAnulado();
      unsubscribeRetiroEliminado();
    };
  }, [show, empresaSeleccionada]);

  const cargarResumenCobros = async () => {
    console.log('🔄 [cargarResumenCobros] INICIANDO con nueva API...');
    setCargandoResumen(true);
    try {
      // 🆕 1. Obtener resumen de cobros empresa
      const { listarCobrosEmpresa, obtenerSaldoDisponible: getSaldoEmpresa } = await import('../services/cobrosEmpresaService');

      const cobrosEmpresa = await listarCobrosEmpresa(empresaSeleccionada.id);
      console.log('📦 Cobros empresa encontrados:', cobrosEmpresa.length);
      console.log('📦 Datos de cobros:', JSON.stringify(cobrosEmpresa, null, 2));

      // 🆕 2. Obtener saldo disponible
      const saldoData = await getSaldoEmpresa(empresaSeleccionada.id);
      console.log('💰 Saldo disponible (respuesta completa):', JSON.stringify(saldoData, null, 2));

      // 3. Filtrar cobros con saldo disponible
      const cobrosConDisponible = cobrosEmpresa.filter(c => {
        const disponible = parseFloat(c.montoDisponible || 0);
        console.log(`Cobro #${c.id}: montoDisponible=${c.montoDisponible}, parseado=${disponible}`);
        return disponible > 0.01;
      });

      console.log('✅ Cobros con saldo disponible:', cobrosConDisponible.length);

      // 4. Obtener total retirado
      let totalRetirado = 0;
      try {
        const saldoRetiros = await obtenerSaldoDisponible(empresaSeleccionada.id);
        totalRetirado = saldoRetiros?.totalRetirado || 0;
        console.log('💸 Total retirado:', totalRetirado);
      } catch (error) {
        console.error('❌ Error obteniendo retiros:', error);
        totalRetirado = 0;
      }

      // 5. Calcular totales
      const totalCobrado = parseFloat(saldoData.totalCobrado || 0);
      const totalAsignado = parseFloat(saldoData.totalAsignado || 0);
      const saldoDisponibleBackend = parseFloat(saldoData.totalDisponible || 0);
      const totalDisponibleCalculado = saldoDisponibleBackend - totalRetirado;

      console.log('💰 Resumen financiero completo:', {
        totalCobrado,
        totalAsignado,
        saldoDisponibleBackend,
        totalRetirado,
        totalDisponibleFinal: totalDisponibleCalculado
      });

      // 6. Guardar estados
      setCobrosNoAsignados(cobrosConDisponible);
      setTotalDisponible(totalDisponibleCalculado);

      setTotalesGlobales({
        totalCobrado,
        totalAsignado,
        totalRetirado,
        totalDisponible: totalDisponibleCalculado,
        cantidadCobros: cobrosEmpresa.length
      });

    } catch (error) {
      console.error('❌ Error cargando resumen de cobros:', error);
      console.error('❌ Stack:', error.stack);
      setCobrosNoAsignados([]);
      setTotalDisponible(0);
      setTotalesGlobales({
        totalCobrado: 0,
        totalAsignado: 0,
        totalRetirado: 0,
        totalDisponible: 0,
        cantidadCobros: 0
      });
    } finally {
      setCargandoResumen(false);
    }
  };

  const cargarObrasDisponibles = async () => {
    try {
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);

      let presupuestosData = Array.isArray(response) ? response :
                             response?.datos ? response.datos :
                             response?.content ? response.content :
                             response?.data ? response.data : [];

      // Filtrar solo APROBADO y EN_EJECUCION
      const estadosPermitidos = ['APROBADO', 'EN_EJECUCION'];
      console.log('🔍 [RegistrarCobro] Total presupuestos antes del filtro:', presupuestosData.length);
      console.log('🔍 [RegistrarCobro] Estados encontrados:', [...new Set(presupuestosData.map(p => p.estado))]);

      presupuestosData = presupuestosData.filter(p => {
        const estadoValido = estadosPermitidos.includes(p.estado);
        if (estadoValido) {
          console.log(`✅ Presupuesto #${p.numeroPresupuesto} - Estado: "${p.estado}" - INCLUIDO`);
        }
        return estadoValido;
      });

      console.log('✅ [RegistrarCobro] Total obras después del filtro:', presupuestosData.length);

      // 🆕 Agrupar por obra y quedarse solo con la última versión
      const obrasPorDireccion = {};
      presupuestosData.forEach(p => {
        const claveObra = `${p.direccionObraCalle}-${p.direccionObraAltura}-${p.direccionObraBarrio || ''}`;

        if (!obrasPorDireccion[claveObra]) {
          obrasPorDireccion[claveObra] = p;
        } else {
          // Comparar versiones y quedarse con la más reciente
          const versionActual = p.numeroVersion || p.version || 0;
          const versionExistente = obrasPorDireccion[claveObra].numeroVersion || obrasPorDireccion[claveObra].version || 0;

          if (versionActual > versionExistente) {
            obrasPorDireccion[claveObra] = p;
          }
        }
      });

      // Convertir el objeto agrupado de vuelta a array
      const presupuestosUnicos = Object.values(obrasPorDireccion);

      console.log(`🔍 [RegistrarCobro] Filtradas ${presupuestosData.length} obras a ${presupuestosUnicos.length} obras únicas (última versión)`);

      // Convertir a formato de obras
      const obras = presupuestosUnicos.map(p => ({
        obraId: p.obraId || p.id, // ← CRÍTICO: agregar obraId
        presupuestoNoClienteId: p.id,
        barrio: p.direccionObraBarrio || null,
        calle: p.direccionObraCalle || '',
        altura: p.direccionObraAltura || '',
        torre: p.direccionObraTorre || null,
        piso: p.direccionObraPiso || null,
        depto: p.direccionObraDepartamento || null,
        nombreObra: p.nombreObra || null,
        numeroPresupuesto: p.numeroPresupuesto,
        numeroVersion: p.numeroVersion || p.version,
        estado: p.estado,
        // Calcular total del presupuesto
        totalPresupuesto: p.totalPresupuestoConHonorarios || p.montoTotal || p.totalFinal || p.totalGeneral || 0
      }));

      console.log('🔍 [DEBUG] Obras cargadas con obraId:', obras.map(o => ({
        numeroPresupuesto: o.numeroPresupuesto,
        obraId: o.obraId,
        presupuestoNoClienteId: o.presupuestoNoClienteId
      })));

      setObrasDisponibles(obras);

      // Inicializar distribución con todas las obras
      const distInicial = obras.map(obra => ({
        obra: obra,
        monto: 0,
        porcentaje: 0
      }));
      setDistribucion(distInicial);

      // Cargar totales de cobros para cada obra
      await cargarTotalesCobros(obras);
    } catch (error) {
      console.error('Error cargando obras:', error);
      setError('Error al cargar obras disponibles');
    }
  };

  const cargarTotalesCobros = async (obras) => {
    try {
      const totales = {};

      console.log('🔄 [RegistrarCobro] Cargando totales de cobros para', obras.length, 'obras');

      // Estrategia alternativa: Obtener TODOS los cobros de la empresa y filtrar localmente
      // Esto evita el error 500 del endpoint /cobros-obra/direccion
      let todosLosCobros = [];

      try {
        // Intentar obtener todos los cobros de la empresa
        const response = await api.get('/api/v1/cobros-obra', {
          params: { empresaId: empresaSeleccionada.id }
        });

        todosLosCobros = Array.isArray(response) ? response :
                        response?.data ? response.data :
                        response?.cobros ? response.cobros : [];

        console.log('📥 Total de cobros de la empresa:', todosLosCobros.length);
      } catch (err) {
        console.warn('⚠️ No se pudieron obtener los cobros de la empresa:', err);
      }

      // Calcular totales para cada obra
      for (const obra of obras) {
        try {
          // Filtrar cobros de esta obra específica por presupuestoNoClienteId
          const cobrosObra = todosLosCobros.filter(c =>
            c.presupuestoNoClienteId === obra.presupuestoNoClienteId
          );

          console.log(`📊 Obra #${obra.numeroPresupuesto} (ID: ${obra.presupuestoNoClienteId}): ${cobrosObra.length} cobros encontrados`);

          // Calcular total cobrado sumando solo los cobros con estado 'COBRADO'
          let cobrado = 0;
          if (cobrosObra.length > 0) {
            cobrado = cobrosObra
              .filter(c => c.estado?.toUpperCase() === 'COBRADO')
              .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

            console.log(`💰 Obra #${obra.numeroPresupuesto}: ${cobrosObra.filter(c => c.estado?.toUpperCase() === 'COBRADO').length} cobros COBRADOS, Total: ${cobrado}`);
          }

          const presupuesto = obra.totalPresupuesto;
          const pendiente = presupuesto - cobrado;

          console.log(`💰 Obra #${obra.numeroPresupuesto} - Presupuesto: ${presupuesto}, Cobrado: ${cobrado}, Pendiente: ${pendiente}`);

          totales[obra.presupuestoNoClienteId] = {
            presupuesto,
            cobrado,
            pendiente
          };
        } catch (err) {
          console.error(`❌ Error procesando cobros de obra ${obra.presupuestoNoClienteId}:`, err);
          // Si hay error, asignar valores por defecto
          totales[obra.presupuestoNoClienteId] = {
            presupuesto: obra.totalPresupuesto,
            cobrado: 0,
            pendiente: obra.totalPresupuesto
          };
        }
      }

      console.log('✅ [RegistrarCobro] Totales finales:', totales);
      setTotalesPorObra(totales);
    } catch (error) {
      console.error('❌ Error cargando totales de cobros:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDistribucionItemChange = (item, campo, valor) => {
    const montoTotalNum = parseFloat(formData.montoTotal) || 0;

    setDistribucionItems(prev => {
      const nuevo = { ...prev };

      if (campo === 'monto') {
        nuevo[item].monto = parseFloat(valor) || 0;
        // Calcular porcentaje automáticamente
        if (montoTotalNum > 0) {
          nuevo[item].porcentaje = ((nuevo[item].monto / montoTotalNum) * 100).toFixed(2);
        }
      } else if (campo === 'porcentaje') {
        nuevo[item].porcentaje = parseFloat(valor) || 0;
        // Calcular monto automáticamente
        if (montoTotalNum > 0) {
          nuevo[item].monto = ((montoTotalNum * nuevo[item].porcentaje) / 100).toFixed(2);
        }
      }

      return nuevo;
    });
  };

  const handleMontoTotalChange = (e) => {
    const nuevoMontoTotal = e.target.value;
    setFormData(prev => ({ ...prev, montoTotal: nuevoMontoTotal }));

    // Recalcular distribución por ítems si hay porcentajes asignados
    if (modoDistribucion === 'POR_ITEMS' && tipoDistribucionItems === 'PORCENTAJE' && nuevoMontoTotal) {
      const total = parseFloat(nuevoMontoTotal);
      setDistribucionItems(prev => ({
        profesionales: {
          ...prev.profesionales,
          monto: ((total * prev.profesionales.porcentaje) / 100).toFixed(2)
        },
        materiales: {
          ...prev.materiales,
          monto: ((total * prev.materiales.porcentaje) / 100).toFixed(2)
        },
        gastosGenerales: {
          ...prev.gastosGenerales,
          monto: ((total * prev.gastosGenerales.porcentaje) / 100).toFixed(2)
        },
        trabajosExtra: {
          ...prev.trabajosExtra,
          monto: ((total * prev.trabajosExtra.porcentaje) / 100).toFixed(2)
        }
      }));
    }

    // Si hay porcentajes asignados, recalcular montos
    if (tipoDistribucion === 'PORCENTAJE' && nuevoMontoTotal) {
      const total = parseFloat(nuevoMontoTotal);
      setDistribucion(prev => prev.map(d => ({
        ...d,
        monto: (total * d.porcentaje / 100).toFixed(2)
      })));
    }
  };

  const handleDistribucionChange = (index, campo, valor) => {
    setDistribucion(prev => {
      const nueva = [...prev];

      if (campo === 'monto') {
        nueva[index].monto = parseFloat(valor) || 0;
        // Calcular porcentaje automáticamente
        if (formData.montoTotal) {
          const total = parseFloat(formData.montoTotal);
          nueva[index].porcentaje = ((nueva[index].monto / total) * 100).toFixed(2);
        }
      } else if (campo === 'porcentaje') {
        nueva[index].porcentaje = parseFloat(valor) || 0;
        // Calcular monto automáticamente
        if (formData.montoTotal) {
          const total = parseFloat(formData.montoTotal);
          nueva[index].monto = (total * nueva[index].porcentaje / 100).toFixed(2);
        }
      }

      return nueva;
    });
  };

  // 🆕 Manejar selección de obras individuales
  const handleToggleObra = (presupuestoNoClienteId) => {
    setObrasSeleccionadas(prev => {
      if (prev.includes(presupuestoNoClienteId)) {
        // Deseleccionar
        return prev.filter(id => id !== presupuestoNoClienteId);
      } else {
        // Seleccionar
        return [...prev, presupuestoNoClienteId];
      }
    });
  };

  // 🆕 Seleccionar/Deseleccionar todas las obras
  const handleToggleTodasObras = () => {
    if (obrasSeleccionadas.length === obrasDisponibles.length) {
      // Si todas están seleccionadas, deseleccionar todas
      setObrasSeleccionadas([]);
    } else {
      // Seleccionar todas
      setObrasSeleccionadas(obrasDisponibles.map(obra => obra.presupuestoNoClienteId));
    }
  };

  // 🆕 Toggle expansión de distribución por ítems de una obra
  const handleToggleExpandirObra = (obraId) => {
    setObrasExpandidas(prev => {
      if (prev.includes(obraId)) {
        return prev.filter(id => id !== obraId);
      } else {
        // Inicializar distribución si no existe
        if (!distribucionPorObra[obraId]) {
          setDistribucionPorObra(prev => ({
            ...prev,
            [obraId]: {
              profesionales: { monto: 0, porcentaje: 0 },
              materiales: { monto: 0, porcentaje: 0 },
              gastosGenerales: { monto: 0, porcentaje: 0 },
              trabajosExtra: { monto: 0, porcentaje: 0 }
            }
          }));
          setTipoDistribucionPorObra(prev => ({
            ...prev,
            [obraId]: 'MONTO'
          }));
        }
        return [...prev, obraId];
      }
    });
  };

  // 🆕 Cambiar tipo de distribución para una obra
  const handleCambiarTipoDistribucionObra = (obraId, tipo) => {
    setTipoDistribucionPorObra(prev => ({
      ...prev,
      [obraId]: tipo
    }));
  };

  // 🆕 Manejar cambios en la distribución por ítems de una obra
  const handleDistribucionItemObraChange = (obraId, item, campo, valor) => {
    const dist = distribucion.find(d => d.obra.presupuestoNoClienteId === obraId);
    if (!dist) return;

    const montoObra = parseFloat(dist.monto) || 0;
    if (montoObra === 0) return;

    setDistribucionPorObra(prev => {
      const nuevaDistribucion = { ...prev };
      if (!nuevaDistribucion[obraId]) {
        nuevaDistribucion[obraId] = {
          profesionales: { monto: 0, porcentaje: 0 },
          materiales: { monto: 0, porcentaje: 0 },
          gastosGenerales: { monto: 0, porcentaje: 0 },
          trabajosExtra: { monto: 0, porcentaje: 0 }
        };
      }

      if (campo === 'monto') {
        const nuevoMonto = parseFloat(valor) || 0;
        nuevaDistribucion[obraId][item].monto = nuevoMonto;
        nuevaDistribucion[obraId][item].porcentaje = ((nuevoMonto / montoObra) * 100).toFixed(2);
      } else if (campo === 'porcentaje') {
        const nuevoPorcentaje = parseFloat(valor) || 0;
        nuevaDistribucion[obraId][item].porcentaje = nuevoPorcentaje;
        nuevaDistribucion[obraId][item].monto = ((montoObra * nuevoPorcentaje) / 100).toFixed(2);
      }

      return nuevaDistribucion;
    });
  };

  const calcularTotales = () => {
    const totalMonto = distribucion.reduce((sum, d) => sum + (parseFloat(d.monto) || 0), 0);
    const totalPorcentaje = distribucion.reduce((sum, d) => sum + (parseFloat(d.porcentaje) || 0), 0);
    return { totalMonto, totalPorcentaje };
  };

  const formatearDireccion = (obra) => {
    const partes = [];
    if (obra.nombreObra) partes.push(`🏗️ ${obra.nombreObra}`);
    partes.push(obra.calle, obra.altura);
    if (obra.barrio) partes.push(`(${obra.barrio})`);

    // Manejar campos opcionales que pueden no estar presentes
    const numPresupuesto = obra.numeroPresupuesto || obra.presupuestoNoClienteId || 'S/N';
    const estado = obra.estado || 'EN_PROCESO';

    return `${partes.join(' ')} [#${numPresupuesto} - ${estado}]`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones comunes
    const montoTotalNum = parseFloat(formData.montoTotal);

    if (!formData.montoTotal || montoTotalNum <= 0) {
      setError('Debe ingresar un monto total mayor a 0');
      return;
    }

    // Validar distribución por ítems si está activa
    if (modoDistribucion === 'POR_ITEMS') {
      const totalItems = parseFloat(distribucionItems.profesionales.monto || 0) +
                         parseFloat(distribucionItems.materiales.monto || 0) +
                         parseFloat(distribucionItems.gastosGenerales.monto || 0) +
                         parseFloat(distribucionItems.trabajosExtra.monto || 0);

      if (Math.abs(totalItems - montoTotalNum) > 0.01) {
        setError(`La suma de los ítems (${formatearMoneda(totalItems)}) no coincide con el monto total (${formatearMoneda(montoTotalNum)})`);
        return;
      }

      if (totalItems === 0) {
        setError('Debe asignar monto a al menos un ítem');
        return;
      }
    }

    // Validar fecha de emisión no sea futura
    const fechaEmisionDate = new Date(formData.fechaEmision);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fechaEmisionDate > hoy) {
      setError('La fecha de emisión no puede ser futura');
      return;
    }

    // Validar fecha de vencimiento >= fecha de emisión
    if (formData.fechaVencimiento) {
      const fechaVencimientoDate = new Date(formData.fechaVencimiento);
      if (fechaVencimientoDate < fechaEmisionDate) {
        setError('La fecha de vencimiento no puede ser anterior a la fecha de emisión');
        return;
      }
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    // Validar obraId en modo individual
    if (modoIndividual && !obraDireccion?.obraId) {
      setError('No se encontró el ID de la obra');
      console.error('❌ obraDireccion no tiene obraId:', obraDireccion);
      return;
    }

    console.log('🔍 DEBUG obraDireccion:', JSON.stringify(obraDireccion, null, 2));
    console.log('🔍 DEBUG obraDireccion.obraId:', obraDireccion?.obraId);

    setLoading(true);

    try {
      // ========== MODO ASIGNAR EXISTENTE: Solo asignar, NO crear cobro ==========
      if (vistaActual === 'asignar-existente') {
        if (!cobroSeleccionado) {
          setError('Debe seleccionar un cobro para asignar');
          setLoading(false);
          return;
        }

        // Obtener obras con monto asignado
        const obrasConMonto = distribucion.filter(d =>
          obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) &&
          parseFloat(d.monto) > 0
        );

        if (obrasConMonto.length === 0) {
          setError('Debe asignar al menos un monto a una obra');
          setLoading(false);
          return;
        }

        // Validar que el total no exceda el disponible del cobro
        const totalAsignar = obrasConMonto.reduce((sum, d) => sum + parseFloat(d.monto), 0);
        const disponible = parseFloat(cobroSeleccionado.montoDisponible || cobroSeleccionado.disponible || 0);

        if (totalAsignar > disponible) {
          setError(`El total a asignar (${formatearMoneda(totalAsignar)}) excede el saldo disponible del cobro (${formatearMoneda(disponible)})`);
          setLoading(false);
          return;
        }

        // Preparar asignaciones
        const asignaciones = obrasConMonto.map(d => {
          const obraId = d.obra.obraId;
          const distObra = distribucionPorObra[d.obra.presupuestoNoClienteId];

          const asignacion = {
            obraId: obraId,
            montoAsignado: parseFloat(d.monto),
            descripcion: `${d.porcentaje.toFixed(1)}% del cobro #${cobroSeleccionado.id} - ${formatearDireccion(d.obra)}`
          };

          // Añadir distribución por ítems si existe
          if (distObra) {
            const distribucionItems = {};

            if (parseFloat(distObra.profesionales?.monto || 0) > 0) {
              distribucionItems.montoProfesionales = parseFloat(distObra.profesionales.monto);
              distribucionItems.porcentajeProfesionales = parseFloat(distObra.profesionales.porcentaje);
            }
            if (parseFloat(distObra.materiales?.monto || 0) > 0) {
              distribucionItems.montoMateriales = parseFloat(distObra.materiales.monto);
              distribucionItems.porcentajeMateriales = parseFloat(distObra.materiales.porcentaje);
            }
            if (parseFloat(distObra.gastosGenerales?.monto || 0) > 0) {
              distribucionItems.montoGastosGenerales = parseFloat(distObra.gastosGenerales.monto);
              distribucionItems.porcentajeGastosGenerales = parseFloat(distObra.gastosGenerales.porcentaje);
            }
            if (parseFloat(distObra.trabajosExtra?.monto || 0) > 0) {
              distribucionItems.montoTrabajosExtra = parseFloat(distObra.trabajosExtra.monto);
              distribucionItems.porcentajeTrabajosExtra = parseFloat(distObra.trabajosExtra.porcentaje);
            }

            if (Object.keys(distribucionItems).length > 0) {
              asignacion.distribucionItems = distribucionItems;
            }
          }

          return asignacion;
        });

        console.log('🚀 [ASIGNAR EXISTENTE] Asignando cobro #' + cobroSeleccionado.id + ' a obras:', asignaciones);
        const resultadoAsignacion = await asignarCobroAObras(cobroSeleccionado.id, asignaciones, empresaSeleccionada.id);
        console.log('✅ Asignación exitosa:', resultadoAsignacion);

        // Limpiar y volver al resumen
        setCobroSeleccionado(null);
        setObrasSeleccionadas([]);
        setDistribucion(obrasDisponibles.map(obra => ({ obra, monto: 0, porcentaje: 0 })));
        setVistaActual('resumen-cobros');
        await cargarResumenCobros();

        setSuccessMessage(`✅ Se asignó ${formatearMoneda(totalAsignar)} del cobro #${cobroSeleccionado.id} a ${obrasConMonto.length} obra(s)`);
        setTimeout(() => setSuccessMessage(null), 5000);

        if (onSuccess) {
          onSuccess({
            mensaje: `Asignación exitosa de ${formatearMoneda(totalAsignar)}`,
            datos: { total: totalAsignar, cantidad: obrasConMonto.length }
          });
        }

        setLoading(false);
        return;
      }

      // ========== MODO INDIVIDUAL: Obra pre-seleccionada ==========
      if (modoIndividual && obraDireccion) {
        // Construir observaciones con distribución por ítems si aplica
        let observacionesFinal = formData.observaciones || null;
        if (modoDistribucion === 'POR_ITEMS') {
          const detalleItems = [];
          if (parseFloat(distribucionItems.profesionales.monto) > 0) {
            detalleItems.push(`👷 Profesionales: ${formatearMoneda(parseFloat(distribucionItems.profesionales.monto))}`);
          }
          if (parseFloat(distribucionItems.materiales.monto) > 0) {
            detalleItems.push(`🔧 Materiales: ${formatearMoneda(parseFloat(distribucionItems.materiales.monto))}`);
          }
          if (parseFloat(distribucionItems.gastosGenerales.monto) > 0) {
            detalleItems.push(`📋 Gastos Generales: ${formatearMoneda(parseFloat(distribucionItems.gastosGenerales.monto))}`);
          }
          if (parseFloat(distribucionItems.trabajosExtra.monto) > 0) {
            detalleItems.push(`🔧 Trabajos Extra: ${formatearMoneda(parseFloat(distribucionItems.trabajosExtra.monto))}`);
          }
          observacionesFinal = (formData.observaciones ? formData.observaciones + ' | ' : '') + detalleItems.join(' | ');
        }

        // 🔵 Payload simplificado según prompt backend
        const cobroData = {
          empresaId: empresaSeleccionada.id,
          presupuestoNoClienteId: obraDireccion.presupuestoNoClienteId,
          fechaCobro: formData.fechaEmision,
          monto: montoTotalNum,
          descripcion: formData.descripcion || `Cobro - ${formatearDireccion(obraDireccion)}`,
          metodoPago: formData.metodoPago,
          estado: 'COBRADO',
          numeroComprobante: formData.numeroComprobante || null,
          tipoComprobante: formData.tipoComprobante || null,
          observaciones: observacionesFinal,
          // 🆕 Asignación inline (cobro + asignación en una transacción)
          asignaciones: [{
            obraId: obraDireccion.obraId,
            montoAsignado: montoTotalNum,
            ...(modoDistribucion === 'POR_ITEMS' && {
              montoProfesionales: parseFloat(distribucionItems.profesionales.monto) || null,
              porcentajeProfesionales: parseFloat(distribucionItems.profesionales.porcentaje) || null,
              montoMateriales: parseFloat(distribucionItems.materiales.monto) || null,
              porcentajeMateriales: parseFloat(distribucionItems.materiales.porcentaje) || null,
              montoGastosGenerales: parseFloat(distribucionItems.gastosGenerales.monto) || null,
              porcentajeGastosGenerales: parseFloat(distribucionItems.gastosGenerales.porcentaje) || null,
              montoTrabajosExtra: parseFloat(distribucionItems.trabajosExtra.monto) || null,
              porcentajeTrabajosExtra: parseFloat(distribucionItems.trabajosExtra.porcentaje) || null
            }),
            observaciones: observacionesFinal
          }]
        };

        console.log('🚀 [MODO INDIVIDUAL] Registrando cobro CON asignación inline:', cobroData);
        console.log('📤 JSON enviado al backend:', JSON.stringify(cobroData, null, 2));
        console.log('🔍 Validación obraId en asignaciones[0]:', cobroData.asignaciones[0].obraId);

        // ✨ Un solo POST: cobro + asignación en transacción
        const cobroCreado = await registrarCobro(cobroData, empresaSeleccionada.id);
        console.log('✅ Cobro + asignación registrados:', cobroCreado);
        console.log('📥 Respuesta del backend:', JSON.stringify(cobroCreado, null, 2));

        // 📡 Notificar al contexto centralizado
        eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
          presupuestoId: obraDireccion.presupuestoNoClienteId,
          monto: montoTotalNum
        });

        // Notificar éxito
        if (onSuccess) {
          onSuccess({
            mensaje: `Cobro registrado exitosamente por ${formatearMoneda(montoTotalNum)}`,
            datos: { total: montoTotalNum, cantidad: 1 }
          });
        }

        // 🆕 Volver al resumen y recargar
        setVistaActual('resumen-cobros');
        await cargarResumenCobros();

        setSuccessMessage(`✅ Cobro registrado exitosamente por ${formatearMoneda(montoTotalNum)}`);
        setTimeout(() => setSuccessMessage(null), 5000);

        return;
      }

      // ========== MODO CONSOLIDADO: Distribución entre obras ==========
      const { totalMonto } = calcularTotales();

      // 🆕 PERMITIR COBRO SIN ASIGNACIÓN (queda disponible para la empresa)
      const obrasConMonto = obrasSeleccionadas.length > 0
        ? distribucion.filter(d =>
            obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) &&
            parseFloat(d.monto) > 0
          )
        : [];

      // Si hay distribución, validar que no exceda el total
      if (obrasConMonto.length > 0 && totalMonto > montoTotalNum) {
        setError(`La suma de los montos asignados (${formatearMoneda(totalMonto)}) no puede exceder el monto total recibido (${formatearMoneda(montoTotalNum)})`);
        setLoading(false);
        return;
      }

      // 🔵 NUEVO FLUJO: Usar API de cobros-empresa
      if (obrasConMonto.length === 0) {
        // ✨ COBRO SIN ASIGNACIÓN - Usar nueva API
        const cobroEmpresaData = {
          montoTotal: montoTotalNum,
          descripcion: formData.descripcion || 'Cobro general - Disponible para asignar',
          fechaCobro: formData.fechaEmision,
          metodoPago: formData.metodoPago,
          numeroComprobante: formData.numeroComprobante || null,
          tipoComprobante: formData.tipoComprobante || null,
          observaciones: formData.observaciones || null
        };

        console.log('🚀 [NUEVO FLUJO - SIN ASIGNACIÓN] Registrando cobro empresa:', cobroEmpresaData);

        const cobroCreado = await registrarCobroEmpresa(cobroEmpresaData, empresaSeleccionada.id);
        console.log('✅ Cobro empresa registrado:', cobroCreado);

        // 🆕 Continuar con limpieza y recarga
        // (el código de limpieza está después del else)

      } else {
        // ✨ COBRO CON ASIGNACIÓN INMEDIATA - Usar nueva API en 2 pasos

        // Paso 1: Registrar cobro empresa
        const cobroEmpresaData = {
          montoTotal: montoTotalNum,
          descripcion: formData.descripcion || `Cobro con ${obrasConMonto.length} asignación(es)`,
          fechaCobro: formData.fechaEmision,
          metodoPago: formData.metodoPago,
          numeroComprobante: formData.numeroComprobante || null,
          tipoComprobante: formData.tipoComprobante || null,
          observaciones: formData.observaciones || null
        };

        console.log('🚀 [NUEVO FLUJO - PASO 1] Registrando cobro empresa:', cobroEmpresaData);
        const cobroCreado = await registrarCobroEmpresa(cobroEmpresaData, empresaSeleccionada.id);
        console.log('✅ Cobro empresa creado:', cobroCreado);

        // Paso 2: Asignar a obras
        const asignaciones = obrasConMonto.map(d => {
          const obraId = d.obra.presupuestoNoClienteId;
          const distObra = distribucionPorObra[obraId];

          const asignacion = {
            obraId: d.obra.obraId,
            montoAsignado: parseFloat(d.monto),
            descripcion: `${d.porcentaje}% del cobro - ${formatearDireccion(d.obra)}`
          };

          // Añadir distribución por ítems si existe
          if (distObra) {
            const distribucionItems = {};

            if (parseFloat(distObra.profesionales?.monto || 0) > 0) {
              distribucionItems.montoProfesionales = parseFloat(distObra.profesionales.monto);
              distribucionItems.porcentajeProfesionales = parseFloat(distObra.profesionales.porcentaje);
            }
            if (parseFloat(distObra.materiales?.monto || 0) > 0) {
              distribucionItems.montoMateriales = parseFloat(distObra.materiales.monto);
              distribucionItems.porcentajeMateriales = parseFloat(distObra.materiales.porcentaje);
            }
            if (parseFloat(distObra.gastosGenerales?.monto || 0) > 0) {
              distribucionItems.montoGastosGenerales = parseFloat(distObra.gastosGenerales.monto);
              distribucionItems.porcentajeGastosGenerales = parseFloat(distObra.gastosGenerales.porcentaje);
            }
            if (parseFloat(distObra.trabajosExtra?.monto || 0) > 0) {
              distribucionItems.montoTrabajosExtra = parseFloat(distObra.trabajosExtra.monto);
              distribucionItems.porcentajeTrabajosExtra = parseFloat(distObra.trabajosExtra.porcentaje);
            }

            if (Object.keys(distribucionItems).length > 0) {
              asignacion.distribucionItems = distribucionItems;
            }
          }

          return asignacion;
        });

        console.log('🚀 [NUEVO FLUJO - PASO 2] Asignando a obras:', asignaciones);
        const resultadoAsignacion = await asignarCobroAObras(cobroCreado.id, asignaciones, empresaSeleccionada.id);
        console.log('✅ Asignación exitosa:', resultadoAsignacion);

        // 📡 Notificar por cada obra asignada
        obrasConMonto.forEach(d => {
          eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
            presupuestoId: d.obra.presupuestoNoClienteId,
            monto: parseFloat(d.monto)
          });
        });
      }

      // Limpiar formulario
      setFormData({
        montoTotal: '',
        descripcion: '',
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
        metodoPago: 'TRANSFERENCIA',
        numeroComprobante: '',
        observaciones: ''
      });

      // Reiniciar distribución
      const distInicial = obrasDisponibles.map(obra => ({
        obra: obra,
        monto: 0,
        porcentaje: 0
      }));
      setDistribucion(distInicial);

      // Mostrar mensaje de éxito
      const mensajeExito = obrasConMonto.length === 0
        ? `✅ Cobro de ${formatearMoneda(montoTotalNum)} registrado - Disponible para asignar`
        : `✅ Cobro registrado con ${obrasConMonto.length} asignación(es) por un total de ${formatearMoneda(montoTotalNum)}`;

      setSuccessMessage(mensajeExito);

      // 🆕 Volver al resumen y recargar
      setVistaActual('resumen-cobros');
      await cargarResumenCobros();

      // Notificar éxito
      if (onSuccess) {
        onSuccess({
          mensaje: mensajeExito,
          datos: { total: montoTotalNum, cantidad: obrasConMonto.length }
        });
      }

      // Auto-ocultar mensaje después de 5 segundos
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error registrando cobros:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Error al registrar cobros. Por favor intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  // 🔹 Ocultar modal principal si hay un modal de retiro abierto
  const modalPrincipalVisible = !mostrarRegistrarRetiro && !mostrarListarRetiros;

  return (
    <>
      {modalPrincipalVisible && (
        <div className="modal show d-block" style={{zIndex: 2000}}>
          <div className="modal-dialog modal-lg" style={{marginTop: '80px', maxWidth: '800px', width: '99vw'}}>
            <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">💰 Registrar Cobro de Obra</h5>
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

            {successMessage && (
              <div className="alert alert-success alert-dismissible fade show" role="alert">
                {successMessage}
                <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
              </div>
            )}

            {/* 🆕 VISTA RESUMEN DE COBROS */}
            {vistaActual === 'resumen-cobros' && (
              <div>
                {cargandoResumen ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p className="mt-3 text-muted">Calculando saldo disponible...</p>
                  </div>
                ) : (
                  <>
                    {/* Resumen de saldo disponible */}
                    <div className="card mb-4 border-primary">
                      <div className="card-header bg-primary text-white">
                        <h5 className="mb-0">💰 Resumen Financiero</h5>
                      </div>
                      <div className="card-body">
                        <div className="row text-center">
                          <div className="col-md-3">
                            <div className="p-3">
                              <h6 className="text-muted mb-2">Total Cobrado</h6>
                              <h3 className="text-success mb-0">
                                {formatearMoneda(totalesGlobales.totalCobrado)}
                              </h3>
                              <small className="text-muted">{totalesGlobales.cantidadCobros} cobro(s)</small>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="p-3 border-start">
                              <h6 className="text-muted mb-2">Asignado a Obras</h6>
                              <h3 className="text-warning mb-0">
                                {formatearMoneda(totalesGlobales.totalAsignado)}
                              </h3>
                              <small className="text-muted">Distribuido</small>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="p-3 border-start">
                              <h6 className="text-muted mb-2">Retiros Personales</h6>
                              <h3 className="text-danger mb-0">
                                {formatearMoneda(totalesGlobales.totalRetirado)}
                              </h3>
                              <small className="text-muted">Retirado</small>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <div className="p-3 border-start">
                              <h6 className="text-muted mb-2">Disponible</h6>
                              <h3 className={`mb-0 ${totalesGlobales.totalDisponible > 0 ? 'text-primary' : 'text-muted'}`}>
                                {formatearMoneda(totalesGlobales.totalDisponible)}
                              </h3>
                              <small className="text-muted">En caja</small>
                            </div>
                          </div>
                        </div>

                        {/* Detalle de cobros con saldo */}
                        {cobrosNoAsignados.length > 0 && (
                          <div className="mt-4">
                            <h6 className="mb-3">📋 Detalle de Cobros con Saldo:</h6>
                            <div className="table-responsive" style={{maxHeight: '200px', overflowY: 'auto'}}>
                              <table className="table table-sm table-hover">
                                <thead className="table-light">
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Descripción</th>
                                    <th className="text-end">Monto</th>
                                    <th className="text-end">Asignado</th>
                                    <th className="text-end">Disponible</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cobrosNoAsignados.map(cobro => (
                                    <tr key={cobro.id}>
                                      <td>{formatearFecha(cobro.fechaCobro)}</td>
                                      <td>
                                        <small>{cobro.descripcion || 'Sin descripción'}</small>
                                      </td>
                                      <td className="text-end fw-bold">{formatearMoneda(cobro.montoTotal || cobro.monto || 0)}</td>
                                      <td className="text-end text-warning">{formatearMoneda(cobro.montoAsignado || cobro.totalAsignado || 0)}</td>
                                      <td className="text-end text-primary fw-bold">{formatearMoneda(cobro.montoDisponible || cobro.disponible || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="row g-3">
                      {/* Columna izquierda: Cobros */}
                      <div className="col-md-6">
                        <div className="card h-100 border-success">
                          <div className="card-header bg-success text-white">
                            <h6 className="mb-0">💵 Registrar un Nuevo Cobro -- Asignar Cobros a Obras</h6>
                          </div>
                          <div className="card-body d-flex flex-column gap-2">
                            {totalDisponible > 0 && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                  setVistaActual('asignar-existente');
                                  cargarObrasDisponibles();
                                }}
                              >
                                📊 Asignar Saldo Disponible ({formatearMoneda(totalDisponible)})
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-success"
                              onClick={() => {
                                setVistaActual('nuevo-cobro');
                                cargarObrasDisponibles();
                              }}
                            >
                              ➕ Generar Nuevo Cobro
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Columna derecha: Retiros */}
                      <div className="col-md-6">
                        <div className="card h-100 border-warning">
                          <div className="card-header bg-warning text-dark">
                            <h6 className="mb-0">💰 Retiros Personales</h6>
                          </div>
                          <div className="card-body d-flex flex-column gap-2">
                            <button
                              type="button"
                              className="btn btn-warning"
                              onClick={() => setMostrarRegistrarRetiro(true)}
                              disabled={totalesGlobales.totalDisponible <= 0}
                            >
                              <i className="bi bi-wallet2 me-2"></i>
                              Registrar Retiro
                              {totalesGlobales.totalDisponible > 0 && (
                                <small className="d-block mt-1">
                                  Disponible: {formatearMoneda(totalesGlobales.totalDisponible)}
                                </small>
                              )}
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline-warning"
                              onClick={() => setMostrarListarRetiros(true)}
                            >
                              <i className="bi bi-list-ul me-2"></i>
                              Ver Historial de Retiros
                            </button>

                            {totalesGlobales.totalRetirado > 0 && (
                              <div className="alert alert-info mb-0 mt-2 py-2">
                                <small>
                                  <i className="bi bi-info-circle me-1"></i>
                                  Total retirado: <strong>{formatearMoneda(totalesGlobales.totalRetirado)}</strong>
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {cobrosNoAsignados.length === 0 && totalesGlobales.totalCobrado === 0 && (
                      <div className="alert alert-info mt-3">
                        <i className="bi bi-info-circle me-2"></i>
                        No hay cobros registrados. Genera tu primer cobro para comenzar.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 🆕 VISTA FORMULARIO (nuevo cobro o asignar existente) */}
            {(vistaActual === 'nuevo-cobro' || vistaActual === 'asignar-existente') && (
              <>
                {/* Botón volver y resumen de cobros */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setVistaActual('resumen-cobros');
                      cargarResumenCobros();
                    }}
                  >
                    ← Volver al resumen
                  </button>

                  <div className="d-flex gap-2">
                    <div className="badge bg-success bg-opacity-10 text-success border border-success px-3 py-2">
                      <i className="bi bi-cash-stack me-1"></i>
                      <strong>Total Cobrado:</strong> {formatearMoneda(totalesGlobales.totalCobrado || 0)}
                    </div>
                    <div className="badge bg-info bg-opacity-10 text-info border border-info px-3 py-2">
                      <i className="bi bi-wallet2 me-1"></i>
                      <strong>Disponible:</strong> {formatearMoneda(totalesGlobales.totalDisponible || 0)}
                    </div>
                  </div>
                </div>

                {/* 🆕 Alerta de saldo disponible de cobros anteriores */}
                {vistaActual === 'nuevo-cobro' && totalDisponible > 0 && (
                  <div className="card border-warning mb-3">
                    <div className="card-header bg-warning bg-opacity-10">
                      <h6 className="mb-0 text-warning">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        💰 Tiene saldo disponible de cobros anteriores: {formatearMoneda(totalDisponible)}
                      </h6>
                    </div>
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th className="text-end">Monto</th>
                              <th className="text-end">Asignado</th>
                              <th className="text-end">Disponible</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cobrosNoAsignados.map(cobro => (
                              <tr key={cobro.id}>
                                <td>
                                  <small>{formatearFecha(cobro.fechaCobro)}</small>
                                </td>
                                <td>
                                  <small>{cobro.descripcion || 'Sin descripción'}</small>
                                </td>
                                <td className="text-end fw-bold">
                                  <small>{formatearMoneda(cobro.montoTotal || cobro.monto || 0)}</small>
                                </td>
                                <td className="text-end text-warning">
                                  <small>{formatearMoneda(cobro.montoAsignado || cobro.totalAsignado || 0)}</small>
                                </td>
                                <td className="text-end text-primary fw-bold">
                                  <small>{formatearMoneda(cobro.montoDisponible || cobro.disponible || 0)}</small>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-light fw-bold">
                            <tr>
                              <td colSpan="4" className="text-end">TOTAL DISPONIBLE:</td>
                              <td className="text-end text-primary">
                                {formatearMoneda(totalDisponible)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                    <div className="card-footer bg-light">
                      <small className="text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        Si desea asignar este saldo a obras, use el botón "Asignar Saldo Disponible" en el resumen de cobros.
                      </small>
                    </div>
                  </div>
                )}

                {vistaActual === 'asignar-existente' && (
                  <>
                    <div className="alert alert-primary mb-3">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <strong>💰 Modo: Asignar Saldo Disponible</strong>
                          <p className="mb-0 mt-1">
                            <small>No se creará un cobro nuevo. Asignarás el saldo de un cobro existente a las obras seleccionadas.</small>
                          </p>
                        </div>
                        <div className="text-end">
                          <small className="text-muted d-block">Saldo Total Disponible</small>
                          <div className="fs-4 fw-bold text-primary">{formatearMoneda(totalDisponible)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Selector de cobro disponible */}
                    <div className="card mb-3 border-primary">
                      <div className="card-header bg-primary bg-opacity-10">
                        <h6 className="mb-0 text-primary">🎯 Seleccionar Cobro a Asignar</h6>
                      </div>
                      <div className="card-body">
                        {cobrosNoAsignados.length === 0 ? (
                          <div className="alert alert-warning mb-0">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            No hay cobros con saldo disponible para asignar
                          </div>
                        ) : (
                          <div className="list-group">
                            {cobrosNoAsignados.map(cobro => (
                              <div
                                key={cobro.id}
                                className={`list-group-item list-group-item-action ${cobroSeleccionado?.id === cobro.id ? 'active' : ''}`}
                                onClick={() => setCobroSeleccionado(cobro)}
                                style={{cursor: 'pointer'}}
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <h6 className="mb-1">
                                      <input
                                        type="radio"
                                        checked={cobroSeleccionado?.id === cobro.id}
                                        onChange={() => setCobroSeleccionado(cobro)}
                                        className="me-2"
                                      />
                                      Cobro #{cobro.id} - {cobro.descripcion || 'Sin descripción'}
                                    </h6>
                                    <small className="text-muted">
                                      {formatearFecha(cobro.fechaCobro)} | {cobro.metodoPago}
                                    </small>
                                  </div>
                                  <div className="text-end">
                                    <div className="text-muted small">Disponible</div>
                                    <div className="fs-5 fw-bold text-success">
                                      {formatearMoneda(cobro.montoDisponible || cobro.disponible || 0)}
                                    </div>
                                    <div className="text-muted small">
                                      de {formatearMoneda(cobro.montoTotal || cobro.monto || 0)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

            <form onSubmit={handleSubmit}>
              {/* MONTO TOTAL RECIBIDO - Solo en modo nuevo-cobro */}
              {vistaActual === 'nuevo-cobro' && (
              <div className="card mb-3 border-success">
                <div className="card-header bg-success text-white">
                  <h6 className="mb-0">💵 {modoIndividual ? 'Monto del Cobro' : 'Monto Total Recibido'}</h6>
                  {modoIndividual && obraDireccion && (
                    <small className="d-block mt-1">
                      📍 Obra: {formatearDireccion(obraDireccion)}
                    </small>
                  )}
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <label className="form-label">
                        Monto <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-lg"
                        name="montoTotal"
                        placeholder="Ej: 500000"
                        value={formData.montoTotal}
                        onChange={handleMontoTotalChange}
                        min="0"
                        step="0.01"
                        required
                        disabled={loading}
                      />
                      {formData.montoTotal && parseFloat(formData.montoTotal) > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-2">
                          <div>
                            <small className="text-muted d-block">Monto Total</small>
                            <div className="text-success fw-bold fs-5">
                              {formatearMoneda(parseFloat(formData.montoTotal))}
                            </div>
                          </div>
                          {!modoIndividual && (
                            <div className="text-end">
                              <small className="text-muted d-block">Disponible</small>
                              <div className={`fw-bold fs-5 ${
                                (() => {
                                  const totalDistribuido = distribucion.reduce((sum, d) =>
                                    sum + (obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) ? (parseFloat(d.monto) || 0) : 0), 0
                                  );
                                  const disponible = parseFloat(formData.montoTotal) - totalDistribuido;
                                  return disponible === 0 ? 'text-success' : disponible > 0 ? 'text-primary' : 'text-danger';
                                })()
                              }`}>
                                {(() => {
                                  const totalDistribuido = distribucion.reduce((sum, d) =>
                                    sum + (obrasSeleccionadas.includes(d.obra.presupuestoNoClienteId) ? (parseFloat(d.monto) || 0) : 0), 0
                                  );
                                  const disponible = parseFloat(formData.montoTotal) - totalDistribuido;
                                  return formatearMoneda(disponible);
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Descripción</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        name="descripcion"
                        placeholder="Ej: Pago cliente Gisell - Anticipo obras"
                        value={formData.descripcion}
                        onChange={handleChange}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
              )}
              {/* Cierre condicional de nuevo-cobro */}

              {/* 🆕 DISTRIBUCIÓN POR ÍTEMS - Solo en modo individual */}
              {modoIndividual && (
                <div className="card mb-3 border-primary">
                  <div className="card-header d-flex justify-content-between align-items-center bg-light">
                    <h6 className="mb-0">📊 Asignación del Cobro</h6>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${modoDistribucion === 'GENERAL' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setModoDistribucion('GENERAL')}
                      >
                        General
                      </button>
                      <button
                        type="button"
                        className={`btn ${modoDistribucion === 'POR_ITEMS' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setModoDistribucion('POR_ITEMS')}
                      >
                        Por Ítems
                      </button>
                    </div>
                  </div>

                  {modoDistribucion === 'GENERAL' && (
                    <div className="card-body">
                      <div className="alert alert-info mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        El monto será registrado de forma <strong>general</strong> sin asignación específica a ítems.
                      </div>
                    </div>
                  )}

                  {modoDistribucion === 'POR_ITEMS' && (
                    <>
                      {(!formData.montoTotal || parseFloat(formData.montoTotal) <= 0) && (
                        <div className="card-body">
                          <div className="alert alert-warning mb-0">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Ingrese un <strong>monto total</strong> para habilitar la distribución por ítems.
                          </div>
                        </div>
                      )}

                      {formData.montoTotal && parseFloat(formData.montoTotal) > 0 && (
                        <>
                          <div className="card-header bg-light border-top d-flex justify-content-between align-items-center py-2">
                        <small className="text-muted">Distribuir entre ítems</small>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            type="button"
                            className={`btn ${tipoDistribucionItems === 'MONTO' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                            onClick={() => setTipoDistribucionItems('MONTO')}
                          >
                            Por Monto
                          </button>
                          <button
                            type="button"
                            className={`btn ${tipoDistribucionItems === 'PORCENTAJE' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                            onClick={() => setTipoDistribucionItems('PORCENTAJE')}
                          >
                            Por %
                          </button>
                        </div>
                      </div>
                      <div className="card-body p-0">
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{width: '40%'}}>Ítem</th>
                              <th style={{width: '30%'}} className="text-end">
                                {tipoDistribucionItems === 'MONTO' ? 'Monto Asignado' : 'Porcentaje'}
                              </th>
                              <th style={{width: '30%'}} className="text-end text-muted">
                                {tipoDistribucionItems === 'MONTO' ? 'Porcentaje' : 'Monto'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>
                                <i className="bi bi-people-fill text-primary me-2"></i>
                                <strong>Profesionales</strong>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={tipoDistribucionItems === 'MONTO' ? distribucionItems.profesionales.monto : distribucionItems.profesionales.porcentaje}
                                  onChange={(e) => handleDistribucionItemChange(
                                    'profesionales',
                                    tipoDistribucionItems === 'MONTO' ? 'monto' : 'porcentaje',
                                    e.target.value
                                  )}
                                  min="0"
                                  step={tipoDistribucionItems === 'MONTO' ? '0.01' : '0.1'}
                                  max={tipoDistribucionItems === 'PORCENTAJE' ? '100' : undefined}
                                  disabled={loading}
                                />
                              </td>
                              <td className="text-end text-muted">
                                <small>
                                  {tipoDistribucionItems === 'MONTO'
                                    ? `${distribucionItems.profesionales.porcentaje}%`
                                    : formatearMoneda(parseFloat(distribucionItems.profesionales.monto) || 0)
                                  }
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <i className="bi bi-tools text-warning me-2"></i>
                                <strong>Materiales</strong>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={tipoDistribucionItems === 'MONTO' ? distribucionItems.materiales.monto : distribucionItems.materiales.porcentaje}
                                  onChange={(e) => handleDistribucionItemChange(
                                    'materiales',
                                    tipoDistribucionItems === 'MONTO' ? 'monto' : 'porcentaje',
                                    e.target.value
                                  )}
                                  min="0"
                                  step={tipoDistribucionItems === 'MONTO' ? '0.01' : '0.1'}
                                  max={tipoDistribucionItems === 'PORCENTAJE' ? '100' : undefined}
                                  disabled={loading}
                                />
                              </td>
                              <td className="text-end text-muted">
                                <small>
                                  {tipoDistribucionItems === 'MONTO'
                                    ? `${distribucionItems.materiales.porcentaje}%`
                                    : formatearMoneda(parseFloat(distribucionItems.materiales.monto) || 0)
                                  }
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <i className="bi bi-receipt text-success me-2"></i>
                                <strong>Gastos Generales</strong>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={tipoDistribucionItems === 'MONTO' ? distribucionItems.gastosGenerales.monto : distribucionItems.gastosGenerales.porcentaje}
                                  onChange={(e) => handleDistribucionItemChange(
                                    'gastosGenerales',
                                    tipoDistribucionItems === 'MONTO' ? 'monto' : 'porcentaje',
                                    e.target.value
                                  )}
                                  min="0"
                                  step={tipoDistribucionItems === 'MONTO' ? '0.01' : '0.1'}
                                  max={tipoDistribucionItems === 'PORCENTAJE' ? '100' : undefined}
                                  disabled={loading}
                                />
                              </td>
                              <td className="text-end text-muted">
                                <small>
                                  {tipoDistribucionItems === 'MONTO'
                                    ? `${distribucionItems.gastosGenerales.porcentaje}%`
                                    : formatearMoneda(parseFloat(distribucionItems.gastosGenerales.monto) || 0)
                                  }
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <i className="bi bi-wrench-adjustable text-info me-2"></i>
                                <strong>Trabajos Extra</strong>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={tipoDistribucionItems === 'MONTO' ? distribucionItems.trabajosExtra.monto : distribucionItems.trabajosExtra.porcentaje}
                                  onChange={(e) => handleDistribucionItemChange(
                                    'trabajosExtra',
                                    tipoDistribucionItems === 'MONTO' ? 'monto' : 'porcentaje',
                                    e.target.value
                                  )}
                                  min="0"
                                  step={tipoDistribucionItems === 'MONTO' ? '0.01' : '0.1'}
                                  max={tipoDistribucionItems === 'PORCENTAJE' ? '100' : undefined}
                                  disabled={loading}
                                />
                              </td>
                              <td className="text-end text-muted">
                                <small>
                                  {tipoDistribucionItems === 'MONTO'
                                    ? `${distribucionItems.trabajosExtra.porcentaje}%`
                                    : formatearMoneda(parseFloat(distribucionItems.trabajosExtra.monto) || 0)
                                  }
                                </small>
                              </td>
                            </tr>
                          </tbody>
                          <tfoot className="table-light">
                            <tr className="fw-bold">
                              <td>TOTAL</td>
                              <td className="text-end">
                                {tipoDistribucionItems === 'MONTO'
                                  ? formatearMoneda(
                                      parseFloat(distribucionItems.profesionales.monto || 0) +
                                      parseFloat(distribucionItems.materiales.monto || 0) +
                                      parseFloat(distribucionItems.gastosGenerales.monto || 0) +
                                      parseFloat(distribucionItems.trabajosExtra.monto || 0)
                                    )
                                  : `${(
                                      parseFloat(distribucionItems.profesionales.porcentaje || 0) +
                                      parseFloat(distribucionItems.materiales.porcentaje || 0) +
                                      parseFloat(distribucionItems.gastosGenerales.porcentaje || 0) +
                                      parseFloat(distribucionItems.trabajosExtra.porcentaje || 0)
                                    ).toFixed(2)}%`
                                }
                              </td>
                              <td className="text-end text-muted">
                                <small>
                                  {tipoDistribucionItems === 'MONTO'
                                    ? `${(
                                        parseFloat(distribucionItems.profesionales.porcentaje || 0) +
                                        parseFloat(distribucionItems.materiales.porcentaje || 0) +
                                        parseFloat(distribucionItems.gastosGenerales.porcentaje || 0)
                                      ).toFixed(2)}%`
                                    : formatearMoneda(
                                        parseFloat(distribucionItems.profesionales.monto || 0) +
                                        parseFloat(distribucionItems.materiales.monto || 0) +
                                        parseFloat(distribucionItems.gastosGenerales.monto || 0)
                                      )
                                  }
                                </small>
                              </td>
                            </tr>
                            {/* Validación visual */}
                            {(() => {
                              const montoTotalNum = parseFloat(formData.montoTotal);
                              const totalDistribuido = parseFloat(distribucionItems.profesionales.monto || 0) +
                                                       parseFloat(distribucionItems.materiales.monto || 0) +
                                                       parseFloat(distribucionItems.gastosGenerales.monto || 0);
                              const diferencia = Math.abs(montoTotalNum - totalDistribuido);

                              if (diferencia > 0.01) {
                                return (
                                  <tr>
                                    <td colSpan="3">
                                      <div className="alert alert-warning mb-0 py-1 px-2">
                                        <small>
                                          <i className="bi bi-exclamation-triangle me-1"></i>
                                          Falta distribuir: {formatearMoneda(diferencia)}
                                        </small>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              } else if (totalDistribuido > 0) {
                                return (
                                  <tr>
                                    <td colSpan="3">
                                      <div className="alert alert-success mb-0 py-1 px-2">
                                        <small>
                                          <i className="bi bi-check-circle me-1"></i>
                                          Monto totalmente distribuido
                                        </small>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }
                              return null;
                            })()}
                          </tfoot>
                        </table>
                      </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* DISTRIBUCIÓN ENTRE OBRAS - Solo en modo consolidado */}
              {!modoIndividual && obrasDisponibles.length > 0 && (
                <div className="card mb-3">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-0">📊 Distribuir entre Obras <span className="badge bg-secondary ms-2">Opcional</span></h6>
                      <small className="text-muted">Si no asignas a ninguna obra, el cobro quedará disponible para asignar posteriormente</small>
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${tipoDistribucion === 'MONTO' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTipoDistribucion('MONTO')}
                      >
                        Por Monto
                      </button>
                      <button
                        type="button"
                        className={`btn ${tipoDistribucion === 'PORCENTAJE' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTipoDistribucion('PORCENTAJE')}
                      >
                        Por Porcentaje
                      </button>
                    </div>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{width: '5%'}} className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={obrasSeleccionadas.length === obrasDisponibles.length && obrasDisponibles.length > 0}
                                onChange={handleToggleTodasObras}
                                disabled={loading}
                                title="Seleccionar todas"
                                style={{width: '18px', height: '18px', cursor: 'pointer', border: '2px solid #495057'}}
                              />
                            </th>
                            <th style={{width: '33%'}}>Obra</th>
                            <th style={{width: '14%'}} className="text-end text-muted">Presupuesto</th>
                            <th style={{width: '14%'}} className="text-end text-success">Cobrado</th>
                            <th style={{width: '14%'}} className="text-end text-danger">Pendiente</th>
                            <th style={{width: '10%'}} className="text-end">
                              {tipoDistribucion === 'MONTO' ? 'Monto' : '%'}
                            </th>
                            <th style={{width: '10%'}} className="text-end text-muted">
                              {tipoDistribucion === 'MONTO' ? '%' : 'Monto'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {distribucion.map((dist, index) => {
                            const totales = totalesPorObra[dist.obra.presupuestoNoClienteId] || {
                              presupuesto: 0,
                              cobrado: 0,
                              pendiente: 0
                            };

                            const estaSeleccionada = obrasSeleccionadas.includes(dist.obra.presupuestoNoClienteId);
                            const estaExpandida = obrasExpandidas.includes(dist.obra.presupuestoNoClienteId);
                            const montoObra = parseFloat(dist.monto) || 0;
                            const tipoDistObra = tipoDistribucionPorObra[dist.obra.presupuestoNoClienteId] || 'MONTO';
                            const distObra = distribucionPorObra[dist.obra.presupuestoNoClienteId] || {
                              profesionales: { monto: 0, porcentaje: 0 },
                              materiales: { monto: 0, porcentaje: 0 },
                              gastosGenerales: { monto: 0, porcentaje: 0 },
                              trabajosExtra: { monto: 0, porcentaje: 0 }
                            };
                            return (
                              <React.Fragment key={index}>
                              <tr className={estaSeleccionada ? 'table-active' : ''}>
                                <td className="text-center align-middle">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={estaSeleccionada}
                                    onChange={() => handleToggleObra(dist.obra.presupuestoNoClienteId)}
                                    disabled={loading}
                                    style={{width: '18px', height: '18px', cursor: 'pointer', border: '2px solid #495057'}}
                                  />
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    {estaSeleccionada && (
                                      <button
                                        type="button"
                                        className={`btn btn-sm ${montoObra > 0 ? 'btn-outline-primary' : 'btn-outline-secondary'} me-2`}
                                        onClick={() => montoObra > 0 && handleToggleExpandirObra(dist.obra.presupuestoNoClienteId)}
                                        title={montoObra > 0 ? "Distribuir por ítems" : "Asigne un monto primero"}
                                        disabled={montoObra === 0}
                                        style={{
                                          fontSize: '0.75rem',
                                          padding: '2px 6px',
                                          fontWeight: '600',
                                          border: montoObra === 0 ? '2px solid #6c757d' : '1px solid',
                                          color: montoObra === 0 ? '#495057' : '',
                                          opacity: montoObra === 0 ? '0.8' : '1'
                                        }}
                                      >
                                        <i className={`bi ${estaExpandida ? 'bi-chevron-down' : 'bi-chevron-right'} me-1`}></i>
                                        Mostrar Secciones
                                      </button>
                                    )}
                                    <small className="text-muted">
                                      {formatearDireccion(dist.obra)}
                                    </small>
                                  </div>
                                </td>
                                <td className="text-end">
                                  <small className="text-muted">
                                    {formatearMoneda(totales.presupuesto)}
                                  </small>
                                </td>
                                <td className="text-end">
                                  <small className="text-success fw-bold">
                                    {formatearMoneda(totales.cobrado)}
                                  </small>
                                </td>
                                <td className="text-end">
                                  <small className={totales.pendiente > 0 ? 'text-danger fw-bold' : 'text-muted'}>
                                    {formatearMoneda(totales.pendiente)}
                                  </small>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-end"
                                    value={tipoDistribucion === 'MONTO' ? (dist.monto || '') : (dist.porcentaje || '')}
                                    onChange={(e) => handleDistribucionChange(
                                      index,
                                      tipoDistribucion === 'MONTO' ? 'monto' : 'porcentaje',
                                      e.target.value
                                    )}
                                    min="0"
                                    step={tipoDistribucion === 'MONTO' ? '0.01' : '0.1'}
                                    max={tipoDistribucion === 'PORCENTAJE' ? '100' : undefined}
                                    disabled={loading || !formData.montoTotal || !estaSeleccionada}
                                    placeholder={tipoDistribucion === 'MONTO' ? '0.00' : '0'}
                                    style={{
                                      MozAppearance: 'textfield',
                                      WebkitAppearance: 'none',
                                      appearance: 'textfield'
                                    }}
                                    onWheel={(e) => e.target.blur()}
                                  />
                                </td>
                                <td className="text-end text-muted">
                                  <small>
                                    {tipoDistribucion === 'MONTO'
                                      ? `${dist.porcentaje}%`
                                      : formatearMoneda(parseFloat(dist.monto) || 0)
                                    }
                                  </small>
                                </td>
                              </tr>

                              {/* 🆕 Fila expandible con distribución por ítems */}
                              {estaExpandida && estaSeleccionada && montoObra > 0 && (
                                <tr className={estaSeleccionada ? 'table-active' : ''}>
                                  <td colSpan="7" className="p-0">
                                    <div className="bg-light border-top" style={{padding: '12px 20px'}}>
                                      <div className="d-flex justify-content-between align-items-center mb-2">
                                        <small className="text-muted fw-bold">
                                          <i className="bi bi-box me-1"></i>
                                          Distribuir {formatearMoneda(montoObra)} entre ítems
                                        </small>
                                        <div className="btn-group btn-group-sm" role="group">
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoDistObra === 'MONTO' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                            onClick={() => handleCambiarTipoDistribucionObra(dist.obra.presupuestoNoClienteId, 'MONTO')}
                                          >
                                            Por %
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoDistObra === 'PORCENTAJE' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                            onClick={() => handleCambiarTipoDistribucionObra(dist.obra.presupuestoNoClienteId, 'PORCENTAJE')}
                                          >
                                            Por Monto
                                          </button>
                                        </div>
                                      </div>

                                      <div className="row g-2">
                                        {/* Profesionales / Jornales */}
                                        <div className="col-md-3">
                                          <div className="card border">
                                            <div className="card-body p-2">
                                              <div className="mb-1">
                                                <small className="fw-bold">
                                                  <i className="bi bi-people-fill text-primary me-1"></i>
                                                  Profesionales/Jornales
                                                </small>
                                              </div>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm mb-1"
                                                placeholder={tipoDistObra === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                value={tipoDistObra === 'MONTO'
                                                  ? (distObra.profesionales.monto || '')
                                                  : (distObra.profesionales.porcentaje || '')}
                                                onChange={(e) => handleDistribucionItemObraChange(
                                                  dist.obra.presupuestoNoClienteId,
                                                  'profesionales',
                                                  tipoDistObra === 'MONTO' ? 'monto' : 'porcentaje',
                                                  e.target.value
                                                )}
                                                min="0"
                                                step={tipoDistObra === 'MONTO' ? '0.01' : '0.1'}
                                                max={tipoDistObra === 'PORCENTAJE' ? '100' : undefined}
                                                disabled={loading}
                                                style={{
                                                  MozAppearance: 'textfield',
                                                  WebkitAppearance: 'none',
                                                  appearance: 'textfield'
                                                }}
                                                onWheel={(e) => e.target.blur()}
                                              />
                                              <small className="text-muted">
                                                {tipoDistObra === 'MONTO'
                                                  ? `${distObra.profesionales.porcentaje}%`
                                                  : formatearMoneda(parseFloat(distObra.profesionales.monto) || 0)
                                                }
                                              </small>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Materiales */}
                                        <div className="col-md-3">
                                          <div className="card border">
                                            <div className="card-body p-2">
                                              <div className="mb-1">
                                                <small className="fw-bold">
                                                  <i className="bi bi-tools text-warning me-1"></i>
                                                  Materiales
                                                </small>
                                              </div>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm mb-1"
                                                placeholder={tipoDistObra === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                value={tipoDistObra === 'MONTO'
                                                  ? (distObra.materiales.monto || '')
                                                  : (distObra.materiales.porcentaje || '')}
                                                onChange={(e) => handleDistribucionItemObraChange(
                                                  dist.obra.presupuestoNoClienteId,
                                                  'materiales',
                                                  tipoDistObra === 'MONTO' ? 'monto' : 'porcentaje',
                                                  e.target.value
                                                )}
                                                min="0"
                                                step={tipoDistObra === 'MONTO' ? '0.01' : '0.1'}
                                                max={tipoDistObra === 'PORCENTAJE' ? '100' : undefined}
                                                disabled={loading}
                                                style={{
                                                  MozAppearance: 'textfield',
                                                  WebkitAppearance: 'none',
                                                  appearance: 'textfield'
                                                }}
                                                onWheel={(e) => e.target.blur()}
                                              />
                                              <small className="text-muted">
                                                {tipoDistObra === 'MONTO'
                                                  ? `${distObra.materiales.porcentaje}%`
                                                  : formatearMoneda(parseFloat(distObra.materiales.monto) || 0)
                                                }
                                              </small>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Gastos Generales / Otros Costos */}
                                        <div className="col-md-3">
                                          <div className="card border">
                                            <div className="card-body p-2">
                                              <div className="mb-1">
                                                <small className="fw-bold">
                                                  <i className="bi bi-receipt text-success me-1"></i>
                                                  Gastos Generales
                                                </small>
                                              </div>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm mb-1"
                                                placeholder={tipoDistObra === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                value={tipoDistObra === 'MONTO'
                                                  ? (distObra.gastosGenerales.monto || '')
                                                  : (distObra.gastosGenerales.porcentaje || '')}
                                                onChange={(e) => handleDistribucionItemObraChange(
                                                  dist.obra.presupuestoNoClienteId,
                                                  'gastosGenerales',
                                                  tipoDistObra === 'MONTO' ? 'monto' : 'porcentaje',
                                                  e.target.value
                                                )}
                                                min="0"
                                                step={tipoDistObra === 'MONTO' ? '0.01' : '0.1'}
                                                max={tipoDistObra === 'PORCENTAJE' ? '100' : undefined}
                                                disabled={loading}
                                                style={{
                                                  MozAppearance: 'textfield',
                                                  WebkitAppearance: 'none',
                                                  appearance: 'textfield'
                                                }}
                                                onWheel={(e) => e.target.blur()}
                                              />
                                              <small className="text-muted">
                                                {tipoDistObra === 'MONTO'
                                                  ? `${distObra.gastosGenerales.porcentaje}%`
                                                  : formatearMoneda(parseFloat(distObra.gastosGenerales.monto) || 0)
                                                }
                                              </small>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Trabajos Extra */}
                                        <div className="col-md-3">
                                          <div className="card border">
                                            <div className="card-body p-2">
                                              <div className="mb-1">
                                                <small className="fw-bold">
                                                  <i className="bi bi-hammer text-info me-1"></i>
                                                  Trabajos Extra
                                                </small>
                                              </div>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm mb-1"
                                                placeholder={tipoDistObra === 'MONTO' ? 'Monto' : 'Porcentaje'}
                                                value={tipoDistObra === 'MONTO'
                                                  ? (distObra.trabajosExtra.monto || '')
                                                  : (distObra.trabajosExtra.porcentaje || '')}
                                                onChange={(e) => handleDistribucionItemObraChange(
                                                  dist.obra.presupuestoNoClienteId,
                                                  'trabajosExtra',
                                                  tipoDistObra === 'MONTO' ? 'monto' : 'porcentaje',
                                                  e.target.value
                                                )}
                                                min="0"
                                                step={tipoDistObra === 'MONTO' ? '0.01' : '0.1'}
                                                max={tipoDistObra === 'PORCENTAJE' ? '100' : undefined}
                                                disabled={loading}
                                                style={{
                                                  MozAppearance: 'textfield',
                                                  WebkitAppearance: 'none',
                                                  appearance: 'textfield'
                                                }}
                                                onWheel={(e) => e.target.blur()}
                                              />
                                              <small className="text-muted">
                                                {tipoDistObra === 'MONTO'
                                                  ? `${distObra.trabajosExtra.porcentaje}%`
                                                  : formatearMoneda(parseFloat(distObra.trabajosExtra.monto) || 0)
                                                }
                                              </small>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Total distribuido */}
                                      <div className="mt-2 pt-2 border-top">
                                        <small className="text-muted">
                                          <strong>Total distribuido:</strong>{' '}
                                          {(() => {
                                            const totalDist = parseFloat(distObra.profesionales.monto || 0) +
                                                            parseFloat(distObra.materiales.monto || 0) +
                                                            parseFloat(distObra.gastosGenerales.monto || 0) +
                                                            parseFloat(distObra.trabajosExtra.monto || 0);
                                            const diferencia = montoObra - totalDist;
                                            const colorClass = Math.abs(diferencia) < 0.01 ? 'text-success' : 'text-danger';
                                            return (
                                              <>
                                                <span className={colorClass}>
                                                  {formatearMoneda(totalDist)}
                                                </span>
                                                {Math.abs(diferencia) >= 0.01 && (
                                                  <span className="text-danger ms-2">
                                                    (Falta: {formatearMoneda(diferencia)})
                                                  </span>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </small>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="table-light fw-bold">
                          <tr>
                            <td></td>
                            <td>TOTAL</td>
                            <td className="text-end text-muted">
                              <small>
                                {formatearMoneda(
                                  Object.values(totalesPorObra).reduce((sum, t) => sum + t.presupuesto, 0)
                                )}
                              </small>
                            </td>
                            <td className="text-end text-success">
                              <small>
                                {formatearMoneda(
                                  Object.values(totalesPorObra).reduce((sum, t) => sum + t.cobrado, 0)
                                )}
                              </small>
                            </td>
                            <td className="text-end text-danger">
                              <small>
                                {formatearMoneda(
                                  Object.values(totalesPorObra).reduce((sum, t) => sum + t.pendiente, 0)
                                )}
                              </small>
                            </td>
                            <td className="text-end">
                              {tipoDistribucion === 'MONTO'
                                ? formatearMoneda(calcularTotales().totalMonto)
                                : `${calcularTotales().totalPorcentaje.toFixed(2)}%`
                              }
                            </td>
                            <td className="text-end text-muted">
                              {tipoDistribucion === 'MONTO'
                                ? `${calcularTotales().totalPorcentaje.toFixed(2)}%`
                                : formatearMoneda(calcularTotales().totalMonto)
                              }
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* 🆕 Alerta cuando no hay obras seleccionadas */}
                  {obrasSeleccionadas.length === 0 && (
                    <div className="card-body border-top">
                      <div className="alert alert-info mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        Seleccione las obras a las que desea asignar el cobro usando los checkboxes de la derecha.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DATOS ADICIONALES */}
              <div className="row">
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">
                      Fecha Emisión <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      name="fechaEmision"
                      value={formData.fechaEmision}
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">Fecha Vencimiento</label>
                    <input
                      type="date"
                      className="form-control"
                      name="fechaVencimiento"
                      value={formData.fechaVencimiento}
                      onChange={handleChange}
                      min={formData.fechaEmision}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">Método de Pago</label>
                    <select
                      className="form-select"
                      name="metodoPago"
                      value={formData.metodoPago}
                      onChange={handleChange}
                      disabled={loading}
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">N° Comprobante</label>
                    <input
                      type="text"
                      className="form-control"
                      name="numeroComprobante"
                      placeholder="Ej: FC-001-00123456"
                      value={formData.numeroComprobante}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Observaciones</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      name="observaciones"
                      placeholder="Observaciones adicionales (opcional)"
                      value={formData.observaciones}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </form>
              </>
            )}
          </div>

          <div className="modal-footer">
            {vistaActual === 'resumen-cobros' ? (
              <button type="button" className="btn btn-secondary" onClick={onHide}>
                Cerrar
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSubmit}
                  disabled={loading || !formData.montoTotal || parseFloat(formData.montoTotal) <= 0}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Registrando...
                    </>
                  ) : (
                    modoIndividual
                  ? '✓ Registrar Cobro'
                  : obrasSeleccionadas.length === 0
                    ? '✓ Registrar Cobro (Sin Asignar)'
                    : `✓ Registrar y Asignar a ${obrasSeleccionadas.length} Obra(s)`
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
      )}

      {/* Modales de Retiros Personales */}
      <RegistrarRetiroModal
        show={mostrarRegistrarRetiro}
        onHide={() => setMostrarRegistrarRetiro(false)}
        onSuccess={(data) => {
          setMostrarRegistrarRetiro(false);
          // El evento ya fue emitido en el modal, se recargará automáticamente
        }}
      />

      <ListarRetirosModal
        show={mostrarListarRetiros}
        onHide={() => setMostrarListarRetiros(false)}
        onSuccess={(data) => {
          // El evento ya fue emitido en el modal, se recargará automáticamente
        }}
      />
    </>
  );
};

export default RegistrarCobroModal;
