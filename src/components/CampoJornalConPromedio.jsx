import React, { useState, useEffect } from 'react';
import usePromedioHonorarios from '../hooks/usePromedioHonorarios';
import { generarOpcionesRoles } from '../constants/rolesProfesionales';

/**
 * Componente reutilizable para campos de jornal con autocompletado basado en promedios
 * de profesionales por rubro y rol
 */
const CampoJornalConPromedio = ({ 
  empresaId,
  rubro,
  rol,
  valor,
  onValorChange,
  onRolChange,
  label = 'Importe x Jornal',
  placeholder = '0.00',
  disabled = false,
  mostrarSelectorRol = false,
  className = ''
}) => {
  const { calcularPromedioHonorariosPorRubroYRol, getRolesPorRubro } = usePromedioHonorarios(empresaId);
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [tienePromedio, setTienePromedio] = useState(false);
  const [mensajeInfo, setMensajeInfo] = useState('');
  const [hayDatos, setHayDatos] = useState(false);

  // Actualizar roles disponibles cuando cambia el rubro
  useEffect(() => {
    if (rubro) {
      const roles = getRolesPorRubro(rubro);
      setRolesDisponibles(roles);
    } else {
      setRolesDisponibles([]);
    }
  }, [rubro, getRolesPorRubro]);

  // Calcular promedio cuando cambian rubro o rol
  useEffect(() => {
    if (rubro && empresaId) {
      const resultado = calcularPromedioHonorariosPorRubroYRol(rubro, rol);
      
      setMensajeInfo(resultado.mensaje || '');
      setHayDatos(resultado.hayDatos || false);
      
      if (resultado.promedio && resultado.promedio !== valor) {
        setTienePromedio(true);
        onValorChange(resultado.promedio);
      } else {
        setTienePromedio(false);
      }
    }
  }, [rubro, rol, empresaId, calcularPromedioHonorariosPorRubroYRol]);

  const handleRolChange = (e) => {
    const nuevoRol = e.target.value;
    if (onRolChange) {
      onRolChange(nuevoRol);
    }
  };

  const handleValorChange = (e) => {
    const nuevoValor = e.target.value;
    setTienePromedio(false); // Al cambiar manualmente, ya no es promedio automático
    onValorChange(nuevoValor);
  };

  return (
    <div className={`campo-jornal-con-promedio ${className}`}>
      {/* Selector de rol (opcional) */}
      {mostrarSelectorRol && (
        <div className="mb-2">
          <label className="form-label small mb-1">Rol/Tipo</label>
          <select
            className="form-select form-select-sm"
            value={rol || ''}
            onChange={handleRolChange}
            disabled={disabled || !rubro}
          >
            <option value="">Seleccionar rol...</option>
            {rolesDisponibles.map(rolDisponible => (
              <option key={rolDisponible} value={rolDisponible}>
                {rolDisponible}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Campo de importe */}
      <div>
        <label className="form-label small mb-1">
          {label}
          {tienePromedio && valor && (
            <span className="text-success ms-1" title="Autocompletado con promedio">
              <i className="fas fa-magic"></i>
            </span>
          )}
        </label>
        <input
          type="number"
          className="form-control form-control-sm"
          value={valor || ''}
          onChange={handleValorChange}
          placeholder={placeholder}
          min="0"
          step="0.01"
          disabled={disabled}
        />
        
        {mensajeInfo && (
          <small className={`d-block mt-1 ${hayDatos ? 'text-success' : 'text-warning'}`}>
            {hayDatos ? <i className="fas fa-info-circle me-1"></i> : <i className="fas fa-exclamation-triangle me-1"></i>}
            {mensajeInfo}
          </small>
        )}
      </div>
    </div>
  );
};

export default CampoJornalConPromedio;