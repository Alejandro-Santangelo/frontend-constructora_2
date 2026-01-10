import React, { useEffect, useRef } from 'react';

const FormularioCrearProfesional = React.memo(({ configRubros, onSubmit, cargando, datos, onDatosChange }) => {
  // DEBUG: Verificar si el componente se desmonta y monta
  const inputRef = useRef(null);

  useEffect(() => {
    console.log('🔰 [FormularioCrearProfesional] MONTADO (v6.0 - LocalStorage Persistence)');

    // Restaurar foco si había un input enfocado antes del desmontaje
    const lastFocusedField = sessionStorage.getItem('formulario_focused_field');
    if (lastFocusedField && inputRef.current) {
      setTimeout(() => {
        const input = document.querySelector(`[name="${lastFocusedField}"]`);
        if (input) {
          input.focus();
          // Posicionar cursor al final
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 100);
    }

    return () => {
      console.log('❌ [FormularioCrearProfesional] DESMONTADO (v6.0 - LocalStorage Persistence)');
      // Guardar qué campo tenía el foco
      const activeElement = document.activeElement;
      if (activeElement && activeElement.name) {
        sessionStorage.setItem('formulario_focused_field', activeElement.name);
      }
    };
  }, []);

  useEffect(() => {
    console.log('🔄 [FormularioCrearProfesional] datos actualizado:', datos);
  }, [datos]);

  const handleChange = (field, value) => {
    console.log(`⚙️ [FormularioCrearProfesional] handleChange llamado - field: ${field}, value: ${value}`);
    const newState = { ...datos, [field]: value };
    if (field === 'rubro') {
      newState.tipoProfesional = ''; // Resetear tipo al cambiar rubro
    }
    console.log('📤 [FormularioCrearProfesional] Enviando nuevo estado:', newState);
    onDatosChange(newState);
  };

  // Helper para generar opciones de rol (copiado logicamente aqui o recibido como prop? mejor duplicar la logica o exportarla si es simple)
  // Como depende de configRubros, podemos usar la logica simple o pasar la funcion.
  // Pero generarOpcionesRol estaba fuera. Lo copiaré aquí para independencia total.

  const convertirRubroAGentilicio = (rubro) => {
    if (!rubro) return '';
    const rubroLower = rubro.toLowerCase().trim();
    // (Simplificado para el ejemplo, o copiar todo el mapa)
    if (rubroLower.includes('albañil')) return 'Albañil';
    if (rubroLower.includes('electric')) return 'Electricista';
    if (rubroLower.includes('plomero') || rubroLower.includes('gas')) return 'Plomero/Gasista';
    if (rubroLower.includes('pint')) return 'Pintor';

    // Fallback generico
    if (rubroLower.endsWith('ería')) return rubro.slice(0, -4);
    return rubro;
  };

  const generarOpcionesRol = (rubro) => {
      if (!rubro || !rubro.trim()) return ['A Definir'];
      // Como estamos extrayendo, usamos una versión simplificada o pasamos la lógica como prop.
      // Mejor confiamos en los tipos definidos en configRubros si existen.
      if (configRubros && configRubros[rubro] && configRubros[rubro].tipos) {
          return [...configRubros[rubro].tipos, 'Otro (personalizado)'];
      }
      return ['Oficial', 'Medio Oficial', 'Ayudante', 'Otro (personalizado)'];
  };

  return (
    <div className="card mb-4 border-primary bg-light" onClick={e => e.stopPropagation()}>
      <div className="card-header bg-primary text-white py-2 px-3 d-flex justify-content-between align-items-center">
          <small className="fw-bold"><i className="fas fa-user-plus me-2"></i>Agregar Nuevo Profesional</small>
          <small style={{fontSize: '0.7em', listStyle: 'none'}}>FIX v3.0 (External)</small>
      </div>
      <div className="card-body p-3">
          <div className="row g-2">
              <div className="col-md-6">
                  <label className="form-label small fw-bold">Nombre Completo</label>
                  <input
                      ref={inputRef}
                      name="nombre"
                      type="text"
                      className="form-control form-control-sm"
                      value={datos.nombre}
                      onChange={e => {
                        e.stopPropagation();
                        handleChange('nombre', e.target.value);
                      }}
                      onFocus={e => e.stopPropagation()}
                      onKeyDown={e => e.stopPropagation()}
                      placeholder="Ej: Juan Perez"
                      autoFocus
                  />
              </div>
              <div className="col-md-6">
                  <label className="form-label small fw-bold">Honorarios por Día ($)</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">$</span>
                    <input
                        type="number"
                        className="form-control form-control-sm"
                        value={datos.costoJornal}
                        onChange={e => {
                          e.stopPropagation();
                          handleChange('costoJornal', e.target.value);
                        }}
                        onFocus={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                        placeholder="0.00"
                    />
                  </div>
              </div>
              <div className="col-md-6">
                  <label className="form-label small fw-bold">Rubro</label>
                  <select
                      className="form-select form-select-sm"
                      value={datos.rubro}
                      onChange={e => {
                        e.stopPropagation();
                        handleChange('rubro', e.target.value);
                      }}
                      onFocus={e => e.stopPropagation()}
                  >
                      <option value="">Seleccionar Rubro...</option>
                      {Object.keys(configRubros).map(r => (
                          <option key={r} value={r}>{configRubros[r]?.emoji || ''} {r}</option>
                      ))}
                  </select>
              </div>
              <div className="col-md-6">
                  <label className="form-label small fw-bold">Tipo / Rol</label>
                  <select
                      className="form-select form-select-sm"
                      value={datos.tipoProfesional}
                      onChange={e => {
                        e.stopPropagation();
                        handleChange('tipoProfesional', e.target.value);
                      }}
                      onFocus={e => e.stopPropagation()}
                      disabled={!datos.rubro}
                  >
                      <option value="">Seleccionar Tipo...</option>
                      {datos.rubro && generarOpcionesRol(datos.rubro).map(t => (
                          <option key={t} value={t}>{t}</option>
                      ))}
                  </select>
              </div>
              <div className="col-12 mt-2">
                  <small className="text-muted fst-italic">
                    * El profesional se guardará en la base de datos y quedará seleccionado.
                  </small>
              </div>
              <div className="col-12 mt-2 text-end">
                  <button
                      className="btn btn-success btn-sm"
                      onClick={() => onSubmit(datos)}
                      disabled={cargando || !datos.nombre || !datos.rubro || !datos.costoJornal}
                  >
                      {cargando ? <i className="fas fa-spinner fa-spin me-1"></i> : <i className="fas fa-save me-1"></i>}
                      Guardar y Seleccionar
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.cargando === nextProps.cargando &&
         prevProps.datos === nextProps.datos;
});

export default FormularioCrearProfesional;
