import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Componente selector de rubros con opción de crear nuevos
 * - Carga rubros desde /api/rubros
 * - Agrupa por categoría
 * - Permite crear rubros personalizados
 * - Valida nombres para evitar duplicados
 * 
 * @param {string} value - Valor actual del rubro seleccionado
 * @param {function} onChange - Callback cuando cambia la selección: (nombreRubro) => void
 * @param {string} placeholder - Placeholder del selector
 * @param {boolean} disabled - Si el selector está deshabilitado
 * @param {array} rubrosExistentesEnPresupuesto - Array de rubros ya usados en este presupuesto (para validación)
 */
const RubroSelector = ({ 
  value = '', 
  onChange, 
  placeholder = 'Seleccionar rubro...', 
  disabled = false,
  rubrosExistentesEnPresupuesto = [],
  rubrosDelPresupuesto = [] // Rubros específicos del presupuesto de la obra
}) => {
  const [rubros, setRubros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modoCreacion, setModoCreacion] = useState(false);
  const [nuevoRubroNombre, setNuevoRubroNombre] = useState('');
  const [validacionError, setValidacionError] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // Agrupar rubros por categoría
  const rubrosPorCategoria = React.useMemo(() => {
    const agrupados = {};
    rubros.forEach(rubro => {
      // Normalizar: soportar tanto 'nombre' como 'nombreRubro'
      const nombreRubro = rubro.nombre || rubro.nombreRubro;
      if (!nombreRubro) return; // Skip si no tiene nombre
      
      const categoria = rubro.categoria || 'otros';
      if (!agrupados[categoria]) {
        agrupados[categoria] = [];
      }
      agrupados[categoria].push({
        ...rubro,
        nombre: nombreRubro // Normalizar a 'nombre'
      });
    });
    return agrupados;
  }, [rubros]);

  // Cargar rubros al montar el componente
  useEffect(() => {
    if (rubrosDelPresupuesto && rubrosDelPresupuesto.length > 0) {
      // Si hay rubros del presupuesto, usarlos por defecto
      setRubros(rubrosDelPresupuesto);
      console.log(`✅ ${rubrosDelPresupuesto.length} rubros del presupuesto cargados por defecto`);
    } else {
      // Si no hay rubros del presupuesto, cargar todos
      cargarRubros();
    }
  }, []);

  // Actualizar rubros cuando cambia mostrarTodos
  useEffect(() => {
    if (mostrarTodos) {
      cargarRubros();
    } else if (rubrosDelPresupuesto && rubrosDelPresupuesto.length > 0) {
      setRubros(rubrosDelPresupuesto);
    }
  }, [mostrarTodos]);

  const cargarRubros = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/rubros');
      // Filtrar solo rubros activos
      const rubrosActivos = (response.data || []).filter(r => r.activo !== false);
      setRubros(rubrosActivos);
    } catch (err) {
      console.error('Error al cargar rubros:', err);
      setError('No se pudieron cargar los rubros. Se usará entrada manual.');
      // Si falla, permitir creación manual
      setModoCreacion(true);
    } finally {
      setLoading(false);
    }
  };

  // Validar nombre de nuevo rubro
  const validarNuevoRubro = (nombre) => {
    setValidacionError('');
    
    if (!nombre || nombre.trim() === '') {
      setValidacionError('El nombre no puede estar vacío');
      return false;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    
    // Verificar si ya existe en rubros maestros (soportar nombre o nombreRubro)
    const existeEnMaestro = rubros.some(r => {
      const nombreRubro = (r.nombre || r.nombreRubro || '').toLowerCase();
      return nombreRubro === nombreNormalizado;
    });
    
    if (existeEnMaestro) {
      setValidacionError('Ya existe un rubro con ese nombre. Selecciónelo de la lista.');
      return false;
    }

    // Verificar si ya existe en este presupuesto
    const existeEnPresupuesto = rubrosExistentesEnPresupuesto.some(
      r => r.toLowerCase() === nombreNormalizado
    );

    if (existeEnPresupuesto) {
      setValidacionError('Este rubro ya está agregado en el presupuesto actual');
      return false;
    }

    // Validar longitud
    if (nombre.trim().length < 3) {
      setValidacionError('El nombre debe tener al menos 3 caracteres');
      return false;
    }

    if (nombre.trim().length > 100) {
      setValidacionError('El nombre no puede superar 100 caracteres');
      return false;
    }

    return true;
  };

  // Manejar creación de nuevo rubro
  const handleCrearRubro = () => {
    if (validarNuevoRubro(nuevoRubroNombre)) {
      // Normalizar nombre (capitalizar primera letra)
      const nombreFinal = nuevoRubroNombre.trim()
        .split(' ')
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
        .join(' ');
      
      onChange(nombreFinal);
      setModoCreacion(false);
      setNuevoRubroNombre('');
      setValidacionError('');
    }
  };

  // Manejar cancelación
  const handleCancelar = () => {
    setModoCreacion(false);
    setNuevoRubroNombre('');
    setValidacionError('');
  };

  // Obtener etiqueta de categoría legible
  const obtenerEtiquetaCategoria = (categoria) => {
    const etiquetas = {
      'estructura': '🏗️ Estructura',
      'instalaciones': '🔌 Instalaciones',
      'terminaciones': '🎨 Terminaciones',
      'servicios': '🧹 Servicios',
      'personalizado': '⚙️ Personalizado',
      'otros': '📦 Otros'
    };
    return etiquetas[categoria] || `📋 ${categoria}`;
  };

  // Renderizar modo creación
  if (modoCreacion) {
    return (
      <div className="border rounded p-3 bg-light">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">✨ Crear Nuevo Rubro</h6>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleCancelar}
            disabled={disabled}
          >
            ✗ Cancelar
          </button>
        </div>
        
        <div className="mb-3">
          <label className="form-label small fw-bold">
            Nombre del nuevo rubro *
          </label>
          <input
            type="text"
            className={`form-control ${validacionError ? 'is-invalid' : ''}`}
            placeholder="Ej: Carpintería Metálica, Gas Natural, etc."
            value={nuevoRubroNombre}
            onChange={(e) => {
              setNuevoRubroNombre(e.target.value);
              if (validacionError) {
                setValidacionError('');
              }
            }}
            onBlur={() => validarNuevoRubro(nuevoRubroNombre)}
            disabled={disabled}
            maxLength={100}
          />
          {validacionError && (
            <div className="invalid-feedback d-block">
              {validacionError}
            </div>
          )}
          <small className="text-muted">
            💡 El rubro se creará automáticamente cuando guarde el presupuesto
          </small>
        </div>

        <button
          type="button"
          className="btn btn-success w-100"
          onClick={handleCrearRubro}
          disabled={disabled || !nuevoRubroNombre.trim() || !!validacionError}
        >
          ✓ Usar Este Rubro
        </button>

        <div className="mt-3 text-center">
          <small className="text-muted">
            o seleccione uno de los rubros estándar:
          </small>
        </div>
      </div>
    );
  }

  // Renderizar selector normal
  return (
    <div>
      {/* Botón para expandir/colapsar */}
      {rubrosDelPresupuesto && rubrosDelPresupuesto.length > 0 && !modoCreacion && (
        <div className="mb-2 d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-info"
            onClick={() => setMostrarTodos(!mostrarTodos)}
            disabled={disabled || loading}
          >
            {mostrarTodos ? (
              <>
                <i className="fas fa-compress-alt me-1"></i>
                Solo del presupuesto
              </>
            ) : (
              <>
                <i className="fas fa-expand-alt me-1"></i>
                Ver todos
              </>
            )}
          </button>
          <small className="text-muted">
            {mostrarTodos 
              ? `${rubros.length} rubros totales` 
              : `${rubrosDelPresupuesto.length} del presupuesto`}
          </small>
        </div>
      )}

      {error && (
        <div className="alert alert-warning py-2 mb-2">
          <small>{error}</small>
        </div>
      )}

      <select
        className="form-select"
        value={value}
        onChange={(e) => {
          const selectedValue = e.target.value;
          if (selectedValue === '__CREAR_NUEVO__') {
            setModoCreacion(true);
          } else {
            onChange(selectedValue);
          }
        }}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? 'Cargando rubros...' : placeholder}
        </option>

        {/* Opción para crear nuevo rubro */}
        {!loading && (
          <option value="__CREAR_NUEVO__" className="fw-bold">
            ➕ Crear nuevo rubro personalizado...
          </option>
        )}

        {/* Rubros agrupados por categoría */}
        {!loading && Object.keys(rubrosPorCategoria).sort().map(categoria => (
          <optgroup key={categoria} label={obtenerEtiquetaCategoria(categoria)}>
            {rubrosPorCategoria[categoria]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map(rubro => (
                <option key={rubro.id} value={rubro.nombre}>
                  {rubro.nombre}
                </option>
              ))
            }
          </optgroup>
        ))}
      </select>

      {/* Ayuda contextual */}
      {!loading && rubros.length > 0 && !error && (
        <small className="text-muted d-block mt-1">
          💡 {rubros.length} rubros disponibles | Seleccione uno o cree uno nuevo
        </small>
      )}
    </div>
  );
};

export default RubroSelector;
