import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import BuscarPorDireccionModal from './BuscarPorDireccionModal';

/**
 * Selector de dirección de obra basado en los 6 campos del PresupuestoNoCliente
 * Barrio, Calle, Altura, Torre, Piso, Depto
 */
const DireccionObraSelector = ({ value, onChange, required = false, label = "Dirección de la Obra", readOnly = false }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [direccionesUnicas, setDireccionesUnicas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredDirecciones, setFilteredDirecciones] = useState([]);
  const [showBusquedaModal, setShowBusquedaModal] = useState(false);

  useEffect(() => {
    if (empresaSeleccionada) {
      cargarPresupuestos();
    }
  }, [empresaSeleccionada]);

  const cargarPresupuestos = async () => {
    setLoading(true);
    try {

      // Usar el endpoint correcto: getAll en lugar de listarTodos
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);

      console.log('📦 Respuesta del backend:', response);

      // La respuesta puede venir en diferentes formatos
      let presupuestosData = Array.isArray(response) ? response :
                             response?.datos ? response.datos :
                             response?.content ? response.content :
                             response?.data ? response.data : [];

      console.log('✅ Presupuestos cargados (sin filtrar):', presupuestosData.length);

      // Log de todos los estados encontrados para debugging
      const estadosEncontrados = [...new Set(presupuestosData.map(p => p.estado))];
      console.log('📊 Estados encontrados en presupuestos:', estadosEncontrados);

      // FILTRAR solo presupuestos con estado: APROBADO, EN_EJECUCION
      const estadosPermitidos = ['APROBADO', 'EN_EJECUCION'];

      console.log('🔍 Filtrando por estados:', estadosPermitidos);
      console.log('🔍 Total presupuestos antes del filtro:', presupuestosData.length);

      presupuestosData = presupuestosData.filter(p => {
        const estadoValido = estadosPermitidos.includes(p.estado);
        console.log(`${estadoValido ? '✅' : '⏭️'} Presupuesto #${p.numeroPresupuesto} - Estado: "${p.estado}" - ${estadoValido ? 'INCLUIDO' : 'FILTRADO'}`);
        return estadoValido;
      });

      console.log('✅ Presupuestos después de filtrar por estado:', presupuestosData.length);
      console.log('📋 Presupuestos filtrados completos:', presupuestosData);

      setPresupuestos(presupuestosData);

      // Extraer direcciones únicas
      const direcciones = extraerDireccionesUnicas(presupuestosData);
      console.log('🏠 Direcciones únicas extraídas:', direcciones.length);
      console.log('📍 Primera dirección:', direcciones[0]);

      setDireccionesUnicas(direcciones);
      setFilteredDirecciones(direcciones); // Inicialmente mostrar todas
    } catch (error) {
      console.error('❌ Error cargando presupuestos:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      setPresupuestos([]);
      setDireccionesUnicas([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extrae direcciones únicas de los presupuestos
   * IMPORTANTE: Cada presupuesto es una entrada separada, aunque compartan dirección
   */
  const extraerDireccionesUnicas = (presupuestosData) => {
    console.log('🔧 Extrayendo direcciones de', presupuestosData.length, 'presupuestos');

    const direcciones = [];

    presupuestosData.forEach((presupuesto, index) => {
      console.log(`📄 Presupuesto ${index + 1}:`, {
        id: presupuesto.id,
        calle: presupuesto.direccionObraCalle,
        altura: presupuesto.direccionObraAltura,
        barrio: presupuesto.direccionObraBarrio,
        numeroPresupuesto: presupuesto.numeroPresupuesto,
        estado: presupuesto.estado
      });

      // Crear clave única con los 6 campos de dirección + ID del presupuesto
      // Esto permite que múltiples presupuestos con la misma dirección se muestren por separado
      const clave = JSON.stringify({
        presupuestoId: presupuesto.id, // ← ESTO ES CLAVE
        barrio: presupuesto.direccionObraBarrio || '',
        calle: presupuesto.direccionObraCalle || '',
        altura: presupuesto.direccionObraAltura || '',
        torre: presupuesto.direccionObraTorre || '',
        piso: presupuesto.direccionObraPiso || '',
        depto: presupuesto.direccionObraDepartamento || ''
      });

      // Solo agregar si tiene al menos calle y altura (obligatorios)
      if (presupuesto.direccionObraCalle && presupuesto.direccionObraAltura) {
        const direccion = {
          // Campos de dirección
          barrio: presupuesto.direccionObraBarrio || null,
          calle: presupuesto.direccionObraCalle || '',
          altura: presupuesto.direccionObraAltura || '',
          torre: presupuesto.direccionObraTorre || null,
          piso: presupuesto.direccionObraPiso || null,
          depto: presupuesto.direccionObraDepartamento || null,
          // Nombre de la obra
          nombreObra: presupuesto.nombreObra || null,
          // ID del presupuesto (para Opción C - Híbrido)
          presupuestoNoClienteId: presupuesto.id,
          // Datos adicionales del presupuesto
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          numeroVersion: presupuesto.numeroVersion || presupuesto.version,
          estado: presupuesto.estado,
          // Guardar la clave para usar como value
          key: clave
        };

        console.log('✅ Presupuesto agregado como opción:', direccion);
        direcciones.push(direccion);
      } else {
        console.warn('⚠️ Presupuesto sin calle/altura, omitido:', presupuesto.id);
      }
    });

    console.log('🏁 Total opciones de presupuesto:', direcciones.length);
    return direcciones;
  };

  /**
   * Formatea la dirección completa para mostrar
   */
  const formatearDireccion = (direccion) => {
    const partes = [];

    // Indicador de trabajo extra
    const prefijoTrabajoExtra = direccion.esTrabajoExtra || direccion.esPresupuestoTrabajoExtra ? '🔧 ' : '';

    // Nombre de la obra (si existe)
    if (direccion.nombreObra) {
      partes.push(`${prefijoTrabajoExtra}🏗️ ${direccion.nombreObra}`);
    }

    // Calle y Altura son obligatorios
    if (direccion.calle) partes.push(direccion.calle);
    if (direccion.altura) partes.push(direccion.altura);

    // Los demás son opcionales
    if (direccion.barrio) partes.push(`(Barrio ${direccion.barrio})`);
    if (direccion.torre) partes.push(`Torre ${direccion.torre}`);
    if (direccion.piso) partes.push(`Piso ${direccion.piso}`);
    if (direccion.depto) partes.push(`Depto ${direccion.depto}`);

    // Agregar info del presupuesto
    const info = [];
    if (direccion.numeroPresupuesto) info.push(`#${direccion.numeroPresupuesto}`);
    if (direccion.numeroVersion) info.push(`v${direccion.numeroVersion}`);
    if (direccion.estado) info.push(direccion.estado);

    const infoStr = info.length > 0 ? ` [${info.join(' - ')}]` : '';

    return partes.length > 0 ? partes.join(', ') + infoStr : 'Sin dirección';
  };

  const handleChange = (e) => {
    const selectedKey = e.target.value;

    if (!selectedKey) {
      onChange(null);
      return;
    }

    // Buscar la dirección seleccionada
    const direccion = filteredDirecciones.find(d => d.key === selectedKey);

    if (direccion && onChange) {
      onChange(direccion);
    }
  };

  const handleSelectFromBusqueda = (presupuesto) => {
    console.log('📌 Presupuesto seleccionado desde búsqueda:', presupuesto);

    // Crear objeto de dirección compatible
    const direccion = {
      barrio: presupuesto.direccionObraBarrio || null,
      calle: presupuesto.direccionObraCalle || '',
      altura: presupuesto.direccionObraAltura || '',
      torre: presupuesto.direccionObraTorre || null,
      piso: presupuesto.direccionObraPiso || null,
      depto: presupuesto.direccionObraDepartamento || null,
      presupuestoNoClienteId: presupuesto.id,
      numeroPresupuesto: presupuesto.numeroPresupuesto,
      numeroVersion: presupuesto.numeroVersion || presupuesto.version,
      estado: presupuesto.estado,
      nombreObra: presupuesto.nombreObra || null,
      key: JSON.stringify({
        barrio: presupuesto.direccionObraBarrio || '',
        calle: presupuesto.direccionObraCalle || '',
        altura: presupuesto.direccionObraAltura || '',
        torre: presupuesto.direccionObraTorre || '',
        piso: presupuesto.direccionObraPiso || '',
        depto: presupuesto.direccionObraDepartamento || ''
      })
    };

    // Agregar a la lista si no existe
    const exists = direccionesUnicas.find(d => d.key === direccion.key);
    if (!exists) {
      setDireccionesUnicas(prev => [...prev, direccion]);
      setFilteredDirecciones(prev => [...prev, direccion]);
    }

    // Seleccionar la dirección
    if (onChange) {
      onChange(direccion);
    }

    // Cerrar modal
    setShowBusquedaModal(false);
  };

  return (
    <div className="mb-3">
      {!readOnly && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label mb-0">
            {label} {required && <span className="text-danger">*</span>}
          </label>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => setShowBusquedaModal(true)}
          >
            <i className="bi bi-search me-1"></i>
            Búsqueda Avanzada
          </button>
        </div>
      )}

      {readOnly && value ? (
        <div className="alert alert-info mb-0">
          <div className="d-flex align-items-start">
            <i className="bi bi-lock-fill me-2 mt-1"></i>
            <div>
              {value.nombreObra && (
                <div className="mb-1">
                  <strong>Obra:</strong> <span className="text-success">{value.nombreObra}</span>
                </div>
              )}
              <div>
                <strong>Dirección:</strong> {value.calle} {value.altura}
                {value.barrio && `, ${value.barrio}`}
                {value.torre && ` • Torre ${value.torre}`}
                {value.piso && ` • Piso ${value.piso}`}
                {value.depto && ` • Depto ${value.depto}`}
              </div>
              <small className="text-muted">
                Presupuesto #{value.numeroPresupuesto || value.presupuestoNoClienteId}
                {value.numeroVersion && ` • Versión ${value.numeroVersion}`}
              </small>
            </div>
          </div>
        </div>
      ) : (
        <select
          className="form-select"
          value={value?.key || ''}
          onChange={handleChange}
          required={required}
          disabled={loading || readOnly}
        >
          <option value="">
            {loading ? 'Cargando direcciones...' : 'Seleccione una dirección'}
          </option>

          {filteredDirecciones.map((direccion, index) => (
            <option key={index} value={direccion.key}>
              {formatearDireccion(direccion)}
            </option>
          ))}
        </select>
      )}

      {filteredDirecciones.length === 0 && !loading && !readOnly && (
        <div className="form-text text-warning">
          <i className="fas fa-exclamation-triangle me-1"></i>
          No se encontraron presupuestos con direcciones registradas
        </div>
      )}

      {value && !readOnly && (
        <div className="form-text text-muted">
          <small>
            {value.nombreObra && (
              <>
                <strong>Obra:</strong> <span className="text-success">{value.nombreObra}</span><br/>
              </>
            )}
            <strong>Dirección seleccionada:</strong><br/>
            <span className="text-primary">
              {value.calle} {value.altura}
            </span>
            {value.barrio && ` • Barrio: ${value.barrio}`}
            {value.torre && ` • Torre: ${value.torre}`}
            {value.piso && ` • Piso: ${value.piso}`}
            {value.depto && ` • Depto: ${value.depto}`}
            <br/>
            <strong>Presupuesto:</strong> #{value.numeroPresupuesto || value.presupuestoNoClienteId}
            {value.numeroVersion && ` • Versión: ${value.numeroVersion}`}
            {value.estado && ` • Estado: ${value.estado}`}
          </small>
        </div>
      )}

      {/* Modal de Búsqueda Avanzada */}
      {!readOnly && (
        <BuscarPorDireccionModal
          show={showBusquedaModal}
          onClose={() => setShowBusquedaModal(false)}
          onSelectPresupuesto={handleSelectFromBusqueda}
        />
      )}
    </div>
  );
};

export default DireccionObraSelector;
