import React, { useState, useEffect } from 'react';
import { formatearMoneda, obtenerColorSemaforo } from '../services/cajaChicaService';
import { useEmpresa } from '../EmpresaContext';
import api, { cajaChicaAPI } from '../services/api';

const ConsultarSaldoCajaChicaModal = ({ 
  show, 
  onHide
}) => {
  const { empresaSeleccionada } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saldoInfo, setSaldoInfo] = useState(null);
  
  // Estados para los selectores
  const [obras, setObras] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  
  // Filtros de dirección
  const [calleSeleccionada, setCalleSeleccionada] = useState('');
  const [alturaSeleccionada, setAlturaSeleccionada] = useState('');
  const [pisoSeleccionado, setPisoSeleccionado] = useState('');
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState('');
  
  const [profesionalesDisponibles, setProfesionalesDisponibles] = useState([]);
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState(null);

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarObras();
      cargarPresupuestos();
      setSaldoInfo(null);
      setCalleSeleccionada('');
      setAlturaSeleccionada('');
      setPisoSeleccionado('');
      setDepartamentoSeleccionado('');
      setProfesionalSeleccionado(null);
    }
  }, [show, empresaSeleccionada]);

  // Filtro progresivo por dirección
  useEffect(() => {
    if (calleSeleccionada && alturaSeleccionada && presupuestos.length > 0) {
      cargarProfesionalesDeObra();
    } else {
      setProfesionalesDisponibles([]);
      setProfesionalSeleccionado(null);
    }
  }, [calleSeleccionada, alturaSeleccionada, pisoSeleccionado, departamentoSeleccionado, presupuestos]);

  const cargarObras = async () => {
    try {
      console.log('🏗️ Cargando obras para empresa:', empresaSeleccionada.id);
      const obrasData = await api.obras.getPorEmpresa(empresaSeleccionada.id);
      console.log('✅ Obras cargadas:', obrasData?.length || 0);
      if (obrasData && obrasData.length > 0) {
        console.log('🔍 Primera obra completa:', obrasData[0]);
        console.log('📋 Campos de la obra:', Object.keys(obrasData[0]));
      }
      setObras(obrasData || []);
    } catch (err) {
      console.error('❌ Error cargando obras:', err);
    }
  };

  const cargarPresupuestos = async () => {
    try {
      console.log('📋 Cargando presupuestos para empresa:', empresaSeleccionada.id);
      const presupuestosData = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      console.log('✅ Presupuestos cargados:', presupuestosData?.length || 0);
      if (presupuestosData && presupuestosData.length > 0) {
        console.log('🔍 Primer presupuesto completo:', presupuestosData[0]);
        console.log('📋 Campos del presupuesto:', Object.keys(presupuestosData[0]));
      }
      setPresupuestos(presupuestosData || []);
    } catch (err) {
      console.error('❌ Error cargando presupuestos:', err);
    }
  };

  // Obtener valores únicos para cada selector (busca en obras Y presupuestos)
  const getCallesUnicas = () => {
    // Normalizar dirección desde distintos campos posibles
    const extractDireccion = (obj) => {
      // Priorizar campos explícitos que uso en la app
      const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
      const alturaCand = obj.direccionObraAltura || obj.altura || '';
      const pisoCand = obj.direccionObraPiso || obj.piso || '';
      const deptoCand = obj.direccionObraDepartamento || obj.departamento || '';

      // Si la "calle" contiene la altura, intentar extraerla (ej: "Obra Larrañaga 15 Piso 2 Depto C")
      let calle = String(calleCand || '');
      let altura = String(alturaCand || '');
      let piso = String(pisoCand || '');
      let depto = String(deptoCand || '');

      if (calle && !altura) {
        const match = calle.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?(?:\s+(?:Depto|depto|DEPTO|Dpto|dpto)\s*(\w+))?/i);
        if (match) {
          calle = match[1].trim();
          altura = match[2] ? String(match[2]).trim() : altura;
          if (match[3]) piso = match[3];
          if (match[4]) depto = match[4];
        }
      }

      return { calle: calle.trim(), altura: altura.trim(), piso: piso.trim(), departamento: depto.trim() };
    };

    const calles = new Set();

    // Agregar calles desde obras
    obras.forEach(o => {
      const d = extractDireccion(o);
      if (d.calle) {
        calles.add(d.calle);
      }
    });

    // Agregar calles desde presupuestos
    presupuestos.forEach(p => {
      const d = extractDireccion(p);
      if (d.calle) {
        calles.add(d.calle);
      }
    });

    const resultado = Array.from(calles).sort();
    console.log('✅ Calles únicas encontradas:', resultado);
    return resultado;
  };

  const getAlturasUnicas = () => {
    if (!calleSeleccionada) return [];
    const alturas = new Set();

    const extractDireccion = (obj) => {
      const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
      const alturaCand = obj.direccionObraAltura || obj.altura || '';
      let calle = String(calleCand || '');
      let altura = String(alturaCand || '');
      if (calle && !altura) {
        const match = calle.match(/^(.+?)\s+(\d+)/i);
        if (match) {
          calle = match[1].trim();
          altura = match[2] ? String(match[2]).trim() : altura;
        }
      }
      return { calle: calle.trim(), altura: altura.trim() };
    };

    // Buscar en obras
    obras.forEach(o => {
      const d = extractDireccion(o);
      if (d.calle === calleSeleccionada && d.altura) alturas.add(d.altura);
    });

    // Buscar en presupuestos
    presupuestos.forEach(p => {
      const d = extractDireccion(p);
      if (d.calle === calleSeleccionada && d.altura) alturas.add(d.altura);
    });

    return Array.from(alturas).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return (isNaN(numA) || isNaN(numB)) ? String(a).localeCompare(String(b)) : numA - numB;
    });
  };

  const getPisosUnicos = () => {
    if (!calleSeleccionada || !alturaSeleccionada) return [];
    const pisos = new Set();
    const extractDireccion = (obj) => {
      const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
      const alturaCand = obj.direccionObraAltura || obj.altura || '';
      const pisoCand = obj.direccionObraPiso || obj.piso || '';
      let calle = String(calleCand || '');
      let altura = String(alturaCand || '');
      let piso = String(pisoCand || '');
      if (calle && !altura) {
        const match = calle.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?/i);
        if (match) {
          calle = match[1].trim();
          altura = match[2] ? String(match[2]).trim() : altura;
          if (match[3]) piso = match[3];
        }
      }
      return { calle: calle.trim(), altura: altura.trim(), piso: piso.trim() };
    };

    obras.forEach(o => {
      const d = extractDireccion(o);
      if (d.calle === calleSeleccionada && d.altura === alturaSeleccionada && d.piso) pisos.add(d.piso);
    });

    presupuestos.forEach(p => {
      const d = extractDireccion(p);
      if (d.calle === calleSeleccionada && d.altura === alturaSeleccionada && d.piso) pisos.add(d.piso);
    });

    return Array.from(pisos).sort();
  };

  const getDepartamentosUnicos = () => {
    if (!calleSeleccionada || !alturaSeleccionada) return [];
    const deptos = new Set();
    const extractDireccion = (obj) => {
      const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
      const alturaCand = obj.direccionObraAltura || obj.altura || '';
      const pisoCand = obj.direccionObraPiso || obj.piso || '';
      const deptoCand = obj.direccionObraDepartamento || obj.departamento || '';
      let calle = String(calleCand || '');
      let altura = String(alturaCand || '');
      let piso = String(pisoCand || '');
      let depto = String(deptoCand || '');
      if (calle && !altura) {
        const match = calle.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?(?:\s+(?:Depto|depto|DEPTO|Dpto|dpto)\s*(\w+))?/i);
        if (match) {
          calle = match[1].trim();
          altura = match[2] ? String(match[2]).trim() : altura;
          if (match[3]) piso = match[3];
          if (match[4]) depto = match[4];
        }
      }
      return { calle: calle.trim(), altura: altura.trim(), piso: piso.trim(), departamento: depto.trim() };
    };

    obras.forEach(o => {
      const d = extractDireccion(o);
      if (d.calle === calleSeleccionada && d.altura === alturaSeleccionada && (!pisoSeleccionado || d.piso === pisoSeleccionado) && d.departamento) deptos.add(d.departamento);
    });

    presupuestos.forEach(p => {
      const d = extractDireccion(p);
      if (d.calle === calleSeleccionada && d.altura === alturaSeleccionada && (!pisoSeleccionado || d.piso === pisoSeleccionado) && d.departamento) deptos.add(d.departamento);
    });

    return Array.from(deptos).sort();
  };

  const cargarProfesionalesDeObra = () => {
    console.log('🔍 Filtrando por:', { calleSeleccionada, alturaSeleccionada, pisoSeleccionado, departamentoSeleccionado });

    // Filtrar presupuestos por dirección seleccionada (usando extracción normalizada)
    const extractDireccion = (obj) => {
      const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
      const alturaCand = obj.direccionObraAltura || obj.altura || '';
      const pisoCand = obj.direccionObraPiso || obj.piso || '';
      const deptoCand = obj.direccionObraDepartamento || obj.departamento || '';
      let calle = String(calleCand || '');
      let altura = String(alturaCand || '');
      let piso = String(pisoCand || '');
      let depto = String(deptoCand || '');
      if (calle && !altura) {
        const match = calle.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?(?:\s+(?:Depto|depto|DEPTO|Dpto|dpto)\s*(\w+))?/i);
        if (match) {
          calle = match[1].trim();
          altura = match[2] ? String(match[2]).trim() : altura;
          if (match[3]) piso = match[3];
          if (match[4]) depto = match[4];
        }
      }
      return { calle: calle.trim(), altura: altura.trim(), piso: piso.trim(), departamento: depto.trim() };
    };

    const presupuestosObra = presupuestos.filter(p => {
      const d = extractDireccion(p);
      const coincideCalle = d.calle === calleSeleccionada;
      const coincideAltura = d.altura === alturaSeleccionada;
      const coincidePiso = !pisoSeleccionado || d.piso === pisoSeleccionado;
      const coincideDepto = !departamentoSeleccionado || d.departamento === departamentoSeleccionado;
      return coincideCalle && coincideAltura && coincidePiso && coincideDepto;
    });

    console.log('📋 Presupuestos filtrados:', presupuestosObra.length);

    // LÓGICA EXACTA DE AsignarCajaChicaModal - Extraer profesionales únicos
    const profesionalesUnicos = new Map();
    presupuestosObra.forEach(presupuesto => {
      try {
        const profesionales = presupuesto.profesionales_json || presupuesto.profesionalesJson || [];
        const profesionalesArray = typeof profesionales === 'string' 
          ? JSON.parse(profesionales) 
          : profesionales;
        
        if (Array.isArray(profesionalesArray)) {
          profesionalesArray.forEach(prof => {
            const nombre = (prof.nombre || prof.nombreProfesional || '').trim();
            const tipo = (prof.tipo || prof.tipoProfesional || '').trim();
            const profId = `${nombre}_${tipo}`.toLowerCase();
            
            if (!profesionalesUnicos.has(profId)) {
              profesionalesUnicos.set(profId, {
                id: profId,
                nombre: nombre,
                tipo: tipo,
                presupuestoId: presupuesto.id
              });
            }
          });
        }
      } catch (err) {
        console.error('Error parseando profesionales:', err);
      }
    });

    const profesionalesLista = Array.from(profesionalesUnicos.values());
    console.log('✅ Profesionales disponibles:', profesionalesLista);
    
    setProfesionalesDisponibles(profesionalesLista);
  };

  const cargarSaldo = async () => {
    if (!profesionalSeleccionado || !calleSeleccionada || !alturaSeleccionada) {
      setError('Debe seleccionar dirección y profesional');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Función para extraer dirección (igual que en cargarProfesionalesDeObra)
      const extractDireccion = (obj) => {
        const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
        const alturaCand = obj.direccionObraAltura || obj.altura || '';
        const pisoCand = obj.direccionObraPiso || obj.piso || '';
        const deptoCand = obj.direccionObraDepartamento || obj.departamento || '';
        let calle = String(calleCand || '');
        let altura = String(alturaCand || '');
        let piso = String(pisoCand || '');
        let depto = String(deptoCand || '');
        if (calle && !altura) {
          const match = calle.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?(?:\s+(?:Depto|depto|DEPTO|Dpto|dpto)\s*(\w+))?/i);
          if (match) {
            calle = match[1].trim();
            altura = match[2] ? String(match[2]).trim() : altura;
            if (match[3]) piso = match[3];
            if (match[4]) depto = match[4];
          }
        }
        return { calle: calle.trim(), altura: altura.trim(), piso: piso.trim(), departamento: depto.trim() };
      };

      // Filtrar presupuestos por dirección seleccionada (usando extractDireccion)
      const presupuestosObra = presupuestos.filter(p => {
        const d = extractDireccion(p);
        const coincideCalle = d.calle === calleSeleccionada;
        const coincideAltura = d.altura === alturaSeleccionada;
        const coincidePiso = !pisoSeleccionado || d.piso === pisoSeleccionado;
        const coincideDepto = !departamentoSeleccionado || d.departamento === departamentoSeleccionado;
        
        return coincideCalle && coincideAltura && coincidePiso && coincideDepto;
      });

      console.log('🔍 ========== CONSULTAR SALDO (NUEVA API - TABLA RELACIONAL) ==========');
      console.log('📦 Presupuesto ID:', presupuestosObra[0].id);
      console.log('👤 Profesional:', profesionalSeleccionado.nombre, profesionalSeleccionado.tipo);

      // Llamar a la nueva API para consultar saldo
      const saldoData = await cajaChicaAPI.consultarSaldo(
        presupuestosObra[0].id,
        profesionalSeleccionado.nombre,
        profesionalSeleccionado.tipo,
        empresaSeleccionada.id
      );

      console.log('✅ Saldo obtenido de la tabla caja_chica_movimientos:');
      console.log('  Total Asignado:', saldoData.totalAsignado);
      console.log('  Total Gastado:', saldoData.totalGastado);
      console.log('  Saldo Actual:', saldoData.saldoActual);
      console.log('🎉 ============================================================');

      // Construir dirección para mostrar
      let direccionCompleta = `${calleSeleccionada} ${alturaSeleccionada}`;
      if (pisoSeleccionado) direccionCompleta += ` Piso ${pisoSeleccionado}`;
      if (departamentoSeleccionado) direccionCompleta += ` Depto ${departamentoSeleccionado}`;

      setSaldoInfo({
        profesionalNombre: profesionalSeleccionado.nombre,
        direccionObra: direccionCompleta,
        montoCajaChicaAsignado: saldoData.totalAsignado,
        gastosRealizados: saldoData.totalGastado,
        saldoActual: saldoData.saldoActual
      });

    } catch (err) {
      console.error('Error consultando saldo:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message ||
        'Error al consultar saldo. Por favor intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const calcularPorcentaje = () => {
    if (!saldoInfo || !saldoInfo.montoCajaChicaAsignado || saldoInfo.montoCajaChicaAsignado === 0) {
      return 0;
    }
    return (saldoInfo.saldoActual / saldoInfo.montoCajaChicaAsignado) * 100;
  };

  const colorSemaforo = saldoInfo 
    ? obtenerColorSemaforo(saldoInfo.saldoActual, saldoInfo.montoCajaChicaAsignado)
    : 'secondary';

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '500px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">💰 Saldo de Caja Chica</h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body">
            {/* Debug info */}
            {presupuestos.length === 0 && (
              <div className="alert alert-info">
                <small>Cargando presupuestos...</small>
              </div>
            )}
            {presupuestos.length > 0 && (
              <div className="alert alert-success">
                <small>✅ {presupuestos.length} presupuesto(s) cargado(s)</small>
              </div>
            )}
            
            {/* Filtros de Dirección */}
            <div className="mb-4 p-3 bg-light rounded">
              <h6 className="mb-3">📍 Dirección de la Obra</h6>
              
              {/* Calle */}
              <div className="mb-3">
                <label className="form-label fw-bold">Calle <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={calleSeleccionada}
                  onChange={(e) => {
                    setCalleSeleccionada(e.target.value);
                    setAlturaSeleccionada('');
                    setPisoSeleccionado('');
                    setDepartamentoSeleccionado('');
                    setProfesionalSeleccionado(null);
                    setSaldoInfo(null);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  <option value="">-- Seleccione calle --</option>
                  {getCallesUnicas().map((calle, idx) => (
                    <option key={idx} value={calle}>{calle}</option>
                  ))}
                </select>
              </div>

              {/* Altura */}
              {calleSeleccionada && (
                <div className="mb-3">
                  <label className="form-label fw-bold">Altura <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={alturaSeleccionada}
                    onChange={(e) => {
                      setAlturaSeleccionada(e.target.value);
                      setPisoSeleccionado('');
                      setDepartamentoSeleccionado('');
                      setProfesionalSeleccionado(null);
                      setSaldoInfo(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <option value="">-- Seleccione altura --</option>
                    {getAlturasUnicas().map((altura, idx) => (
                      <option key={idx} value={altura}>{altura}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Piso (opcional) */}
              {alturaSeleccionada && getPisosUnicos().length > 0 && (
                <div className="mb-3">
                  <label className="form-label fw-bold">Piso (opcional)</label>
                  <select
                    className="form-select"
                    value={pisoSeleccionado}
                    onChange={(e) => {
                      setPisoSeleccionado(e.target.value);
                      setDepartamentoSeleccionado('');
                      setProfesionalSeleccionado(null);
                      setSaldoInfo(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <option value="">-- Todos los pisos --</option>
                    {getPisosUnicos().map((piso, idx) => (
                      <option key={idx} value={piso}>{piso}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Departamento (opcional) */}
              {alturaSeleccionada && getDepartamentosUnicos().length > 0 && (
                <div className="mb-3">
                  <label className="form-label fw-bold">Departamento (opcional)</label>
                  <select
                    className="form-select"
                    value={departamentoSeleccionado}
                    onChange={(e) => {
                      setDepartamentoSeleccionado(e.target.value);
                      setProfesionalSeleccionado(null);
                      setSaldoInfo(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <option value="">-- Todos los departamentos --</option>
                    {getDepartamentosUnicos().map((depto, idx) => (
                      <option key={idx} value={depto}>{depto}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Selector de Profesional */}
            {calleSeleccionada && alturaSeleccionada && (
              <div className="mb-4">
                <label className="form-label fw-bold">Profesional:</label>
                <select
                  className="form-select"
                  value={profesionalSeleccionado ? JSON.stringify(profesionalSeleccionado) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setProfesionalSeleccionado(JSON.parse(e.target.value));
                      setSaldoInfo(null);
                      setError(null);
                    } else {
                      setProfesionalSeleccionado(null);
                    }
                  }}
                  disabled={loading || profesionalesDisponibles.length === 0}
                >
                  <option value="">
                    {profesionalesDisponibles.length === 0 
                      ? 'No hay profesionales en esta obra'
                      : 'Seleccione un profesional'
                    }
                  </option>
                  {profesionalesDisponibles.map((prof, idx) => (
                    <option key={idx} value={JSON.stringify(prof)}>
                      {prof.nombre} ({prof.tipo})
                    </option>
                  ))}
                </select>
                {profesionalesDisponibles.length > 0 && (
                  <small className="text-muted d-block mt-1">
                    {profesionalesDisponibles.length} profesional(es) disponible(s)
                  </small>
                )}
              </div>
            )}

            {profesionalSeleccionado && !saldoInfo && !loading && (
              <div className="mb-3">
                <button 
                  className="btn btn-primary w-100 mb-2"
                  onClick={cargarSaldo}
                >
                  🔍 Consultar Saldo
                </button>
                <button 
                  className="btn btn-warning w-100 btn-sm"
                  onClick={() => {
                    console.log('🔍 ========== DEBUG DETALLADO ==========');
                    console.log('📍 Dirección seleccionada:', {
                      calle: calleSeleccionada,
                      altura: alturaSeleccionada,
                      piso: pisoSeleccionado,
                      departamento: departamentoSeleccionado
                    });
                    console.log('👤 Profesional seleccionado:', profesionalSeleccionado);
                    console.log('📦 Total presupuestos cargados:', presupuestos.length);
                    
                    // Filtrar presupuestos
                    const extractDireccion = (obj) => {
                      const calleCand = obj.direccionObraCalle || obj.direccionParticular || obj.calle || obj.direccion || obj.nombreObra || obj.nombre || '';
                      const alturaCand = obj.direccionObraAltura || obj.altura || '';
                      const pisoCand = obj.direccionObraPiso || obj.piso || '';
                      const deptoCand = obj.direccionObraDepartamento || obj.departamento || '';
                      let calle = String(calleCand || '');
                      let altura = String(alturaCand || '');
                      let piso = String(pisoCand || '');
                      let depto = String(deptoCand || '');
                      if (calle && !altura) {
                        const match = calle.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?(?:\s+(?:Depto|depto|DEPTO|Dpto|dpto)\s*(\w+))?/i);
                        if (match) {
                          calle = match[1].trim();
                          altura = match[2] ? String(match[2]).trim() : altura;
                          if (match[3]) piso = match[3];
                          if (match[4]) depto = match[4];
                        }
                      }
                      return { calle: calle.trim(), altura: altura.trim(), piso: piso.trim(), departamento: depto.trim() };
                    };
                    
                    const presupuestosFiltrados = presupuestos.filter(p => {
                      const d = extractDireccion(p);
                      const coincideCalle = d.calle === calleSeleccionada;
                      const coincideAltura = d.altura === alturaSeleccionada;
                      const coincidePiso = !pisoSeleccionado || d.piso === pisoSeleccionado;
                      const coincideDepto = !departamentoSeleccionado || d.departamento === departamentoSeleccionado;
                      return coincideCalle && coincideAltura && coincidePiso && coincideDepto;
                    });
                    
                    console.log('✅ Presupuestos que coinciden con la dirección:', presupuestosFiltrados.length);
                    
                    presupuestosFiltrados.forEach((p, idx) => {
                      console.log(`\n📋 PRESUPUESTO ${idx + 1} (ID: ${p.id}):`);
                      console.log('  Dirección:', extractDireccion(p));
                      
                      const otrosCostos = typeof p.otrosCostosJson === 'string'
                        ? JSON.parse(p.otrosCostosJson || '[]')
                        : (Array.isArray(p.otrosCostosJson) ? p.otrosCostosJson : []);
                      
                      console.log('  otrosCostosJson:', otrosCostos);
                      
                      const cajasChicas = otrosCostos.filter(c => c.tipo === 'CAJA_CHICA');
                      console.log('  💰 Cajas chicas encontradas:', cajasChicas.length);
                      cajasChicas.forEach((cc, i) => {
                        console.log(`    Caja Chica ${i + 1}:`, {
                          profesionalNombre: cc.profesionalNombre,
                          profesionalTipo: cc.profesionalTipo,
                          monto: cc.monto,
                          fecha: cc.fecha
                        });
                        console.log(`    �🔍 Comparación con seleccionado:`, {
                          nombreGuardado: cc.profesionalNombre,
                          nombreBuscado: profesionalSeleccionado.nombre,
                          coincide: cc.profesionalNombre === profesionalSeleccionado.nombre,
                          tipoGuardado: cc.profesionalTipo,
                          tipoBuscado: profesionalSeleccionado.tipo,
                          coincideTipo: cc.profesionalTipo === profesionalSeleccionado.tipo
                        });
                      });
                    });
                    
                    console.log('🔍 ======================================');
                  }}
                >
                  🐛 Ver Debug en Consola
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-5">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3 text-muted">Consultando saldo...</p>
              </div>
            )}

            {error && !loading && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {!loading && !error && saldoInfo && (
              <>
                {/* Información del profesional */}
                <div className="mb-4 p-3 bg-light rounded">
                  <div className="mb-2">
                    <strong>Profesional:</strong> {saldoInfo.profesionalNombre || 'No especificado'}
                  </div>
                  <div>
                    <strong>Obra:</strong> {saldoInfo.direccionObra || 'No especificada'}
                  </div>
                </div>

                {/* Indicador de saldo */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-bold">Estado del Saldo:</span>
                    <span className={`badge bg-${colorSemaforo}`} style={{ fontSize: '0.9rem' }}>
                      {calcularPorcentaje().toFixed(0)}%
                    </span>
                  </div>
                  <div className="progress" style={{ height: '25px' }}>
                    <div 
                      className={`progress-bar bg-${colorSemaforo}`}
                      role="progressbar"
                      style={{ width: `${calcularPorcentaje()}%` }}
                      aria-valuenow={calcularPorcentaje()}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      {calcularPorcentaje().toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-muted small mt-1">
                    {colorSemaforo === 'success' && '✓ Saldo saludable (>70%)'}
                    {colorSemaforo === 'warning' && '⚠ Saldo medio (30-70%)'}
                    {colorSemaforo === 'danger' && '⚠ Saldo bajo (<30%)'}
                    {colorSemaforo === 'secondary' && 'ℹ Sin caja chica asignada'}
                  </div>
                </div>

                {/* Detalles financieros */}
                <div className="border rounded p-3">
                  <div className="d-flex justify-content-between mb-3 pb-3 border-bottom">
                    <span className="text-muted">Monto Asignado:</span>
                    <strong className="fs-5">
                      {formatearMoneda(saldoInfo.montoCajaChicaAsignado || 0)}
                    </strong>
                  </div>

                  <div className="d-flex justify-content-between mb-3 pb-3 border-bottom">
                    <span className="text-muted">Gastos Realizados:</span>
                    <strong className="fs-5 text-danger">
                      {formatearMoneda(saldoInfo.gastosRealizados || 0)}
                    </strong>
                  </div>

                  <div className="d-flex justify-content-between">
                    <span className="text-muted fw-bold">Saldo Disponible:</span>
                    <strong className={`fs-4 text-${colorSemaforo}`}>
                      {formatearMoneda(saldoInfo.saldoActual || 0)}
                    </strong>
                  </div>
                </div>

                {/* Mensaje si no tiene caja chica */}
                {(!saldoInfo.montoCajaChicaAsignado || saldoInfo.montoCajaChicaAsignado === 0) && (
                  <div className="alert alert-info mt-3">
                    <i className="bi bi-info-circle me-2"></i>
                    Este profesional aún no tiene caja chica asignada.
                  </div>
                )}

                {/* Alerta si saldo bajo */}
                {colorSemaforo === 'danger' && saldoInfo.montoCajaChicaAsignado > 0 && (
                  <div className="alert alert-warning mt-3">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    <strong>Saldo bajo.</strong> Considere asignar más fondos o revisar gastos.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
            {!loading && !error && (
              <button type="button" className="btn btn-primary" onClick={cargarSaldo}>
                🔄 Actualizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultarSaldoCajaChicaModal;
