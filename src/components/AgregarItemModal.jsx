import React, { useState, useRef } from 'react';
import { validarTipoItem, agregarNuevoProfesional } from '../utils/validacionProfesionalesMateriales';

const AgregarItemModal = ({ show, onClose, onSave, tipo }) => {
  const [item, setItem] = useState(
    tipo === 'material' ? {
      nombre: '', cantidad: '', unidadMedida: '', precioUnitario: '', observaciones: ''
    } : tipo === 'profesional' ? {
      tipo: '', horas: '', dias: '', semanas: '', meses: '', honorarioHora: '', honorarioDia: '', honorarioSemana: '', honorarioMes: ''
    } : {
      monto: '', descripcion: '', observaciones: '', fecha: new Date().toISOString().slice(0,16)
    }
  );

  const [errorValidacion, setErrorValidacion] = useState(null);
  const [advertencia, setAdvertencia] = useState(null);

  const handleChange = e => {
    const { name, value } = e.target;
    setItem({ ...item, [name]: value });
    
    // Validar en tiempo real solo cuando se escribe el nombre del material o el tipo del profesional
    if ((tipo === 'material' && name === 'nombre') || (tipo === 'profesional' && name === 'tipo')) {
      if (value.trim().length > 2) {
        const validacion = validarTipoItem(value, tipo);
        
        if (!validacion.esValido) {
          setErrorValidacion(validacion.mensaje);
          setAdvertencia(null);
        } else {
          setErrorValidacion(null);
          
          // Si es profesional y tiene baja similitud, mostrar advertencia
          if (tipo === 'profesional' && validacion.similitud < 0.4 && validacion.similitud > 0) {
            setAdvertencia(`💡 "${value}" no coincide con profesionales conocidos. Se agregará como nuevo tipo.`);
          } else {
            setAdvertencia(null);
          }
        }
      } else {
        setErrorValidacion(null);
        setAdvertencia(null);
      }
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    
    // Validación final antes de guardar
    let campoAValidar = null;
    if (tipo === 'material' && item.nombre) {
      campoAValidar = item.nombre;
    } else if (tipo === 'profesional' && item.tipo) {
      campoAValidar = item.tipo;
    }
    
    if (campoAValidar) {
      const validacion = validarTipoItem(campoAValidar, tipo);
      
      if (!validacion.esValido && tipo === 'material') {
        // No permitir agregar profesionales en materiales
        alert(validacion.mensaje);
        return;
      }
      
      // Si es profesional nuevo, agregarlo a la lista
      if (tipo === 'profesional' && validacion.similitud < 0.6) {
        agregarNuevoProfesional(campoAValidar);
      }
    }
    
    onSave(item);
    setErrorValidacion(null);
    setAdvertencia(null);
    onClose();
  };

  const modalRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleDragStart = (e) => {
    setDragging(true);
    const rect = modalRef.current.getBoundingClientRect();
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    setOffset({ x: clientX - rect.left, y: clientY - rect.top });
  };

  const handleDrag = (e) => {
    if (!dragging) return;
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    setPosition({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: '#4fc3f7', opacity: 1, zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-dialog"
        ref={modalRef}
        style={{ zIndex: 10000, position: 'absolute', left: position.x, top: position.y }}
      >
        <div className="modal-content" style={{ background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', borderRadius: '10px' }}>
          <form onSubmit={handleSubmit}>
            <div
              className="modal-header"
              style={{ cursor: 'move' }}
              onMouseDown={handleDragStart}
              onMouseMove={handleDrag}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchMove={handleDrag}
              onTouchEnd={handleDragEnd}
            >
              <h5 className="modal-title">Agregar {tipo === 'material' ? 'Material' : tipo === 'profesional' ? 'Profesional' : 'Otro Costo'}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body" style={{ marginTop: '40px' }}>
              {/* Mensajes de validación */}
              {errorValidacion && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <div style={{ whiteSpace: 'pre-line' }}>{errorValidacion}</div>
                </div>
              )}
              
              {advertencia && !errorValidacion && (
                <div className="alert alert-warning" role="alert">
                  <i className="fas fa-info-circle me-2"></i>
                  {advertencia}
                </div>
              )}
              
              {tipo === 'material' && (
                <>
                  <input name="nombre" className="form-control mb-2" placeholder="Nombre del Material" value={item.nombre} onChange={handleChange} />
                  <input name="cantidad" type="number" className="form-control mb-2" placeholder="Cantidad" value={item.cantidad} onChange={handleChange} />
                  <input name="unidadMedida" className="form-control mb-2" placeholder="Unidad de Medida" value={item.unidadMedida} onChange={handleChange} />
                  <input name="precioUnitario" type="number" className="form-control mb-2" placeholder="Precio Unitario" value={item.precioUnitario} onChange={handleChange} />
                  <input name="observaciones" className="form-control mb-2" placeholder="Observaciones" value={item.observaciones} onChange={handleChange} />
                </>
              )}
              {tipo === 'profesional' && (
                <>
                  <input name="tipo" className="form-control mb-2" placeholder="Tipo de Profesional" value={item.tipo} onChange={handleChange} />
                  <input name="horas" type="number" className="form-control mb-2" placeholder="Horas" value={item.horas} onChange={handleChange} />
                  <input name="dias" type="number" className="form-control mb-2" placeholder="Días" value={item.dias} onChange={handleChange} />
                  <input name="semanas" type="number" className="form-control mb-2" placeholder="Semanas" value={item.semanas} onChange={handleChange} />
                  <input name="meses" type="number" className="form-control mb-2" placeholder="Meses" value={item.meses} onChange={handleChange} />
                  <input name="honorarioHora" type="number" className="form-control mb-2" placeholder="Honorario Hora" value={item.honorarioHora} onChange={handleChange} />
                  <input name="honorarioDia" type="number" className="form-control mb-2" placeholder="Honorario Día" value={item.honorarioDia} onChange={handleChange} />
                  <input name="honorarioSemana" type="number" className="form-control mb-2" placeholder="Honorario Semana" value={item.honorarioSemana} onChange={handleChange} />
                  <input name="honorarioMes" type="number" className="form-control mb-2" placeholder="Honorario Mes" value={item.honorarioMes} onChange={handleChange} />
                </>
              )}
              {tipo === 'otro' && (
                <>
                  <input name="monto" type="number" className="form-control mb-2" placeholder="Monto" value={item.monto} onChange={handleChange} />
                  <input name="descripcion" className="form-control mb-2" placeholder="Descripción" value={item.descripcion} onChange={handleChange} />
                  <input name="observaciones" className="form-control mb-2" placeholder="Observaciones" value={item.observaciones} onChange={handleChange} />
                  <input name="fecha" type="datetime-local" className="form-control mb-2" placeholder="Fecha" value={item.fecha} onChange={handleChange} />
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={!!errorValidacion}>
                {errorValidacion ? 'Corrije el error' : 'Agregar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AgregarItemModal;
