import React, { useEffect, useState } from 'react';

const ObraSelector = ({ empresaId, value, onChange, onClick, required = false, className = "form-select", placeholder = "Seleccionar obra...", style, disabled }) => {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (empresaId) {
      setLoading(true);
      fetch(`/api/obras/empresa/${empresaId}`)
        .then(res => res.json())
        .then(data => {
          const obrasArray = Array.isArray(data) ? data : [];
          console.log(`📋 Total obras cargadas para empresa ${empresaId}:`, obrasArray.length);

          // 🔍 DEBUG: Mostrar todas las obras con sus propiedades clave
          console.table(obrasArray.map(o => ({
            id: o.id || o.idObra,
            nombre: o.nombre || o.nombreObra || o.nombre_obra || 'Sin nombre',
            estado: o.estado,
            esTrabajoExtra: o.esObraTrabajoExtra || o.es_obra_trabajo_extra || false,
            obraOrigenId: o.obraOrigenId || o.obra_origen_id || null
          })));

          // 🔧 FILTROS:
          // 1. Excluir obras canceladas/eliminadas
          // ⚠️ TODO: El backend no devuelve correctamente esObraTrabajoExtra, por ahora mostrar todas
          const estadosExcluidos = ['CANCELADO', 'CANCELADA', 'ELIMINADO', 'ELIMINADA'];
          const obrasFiltradas = obrasArray.filter(obra => {
            const nombreObra = obra.nombre || obra.nombreObra || obra.nombre_obra || 'Sin nombre';

            // Excluir por estado
            if (estadosExcluidos.includes(obra.estado)) {
              console.log(`⚠️ Excluyendo por estado "${obra.estado}": ${nombreObra} (ID: ${obra.id || obra.idObra})`);
              return false;
            }

            return true;
          });

          console.log(`✅ Obras principales disponibles (excluidos: estados no válidos):`, obrasFiltradas.length);
          setObras(obrasFiltradas);
          setLoading(false);
        })
        .catch((error) => {
          console.error('❌ Error cargando obras:', error);
          setObras([]);
          setLoading(false);
        });
    } else {
      setObras([]);
    }
  }, [empresaId]);

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Cargando obras...</option>
      </select>
    );
  }

  // Función para formatear la dirección completa
  const formatearDireccionObra = (obra) => {
    // PRIORIDAD 1: Si tiene nombreObra definido por el usuario, usarlo
    if (obra.nombreObra && obra.nombreObra.trim() !== '' && obra.nombreObra.trim() !== 'Casa Completa') {
      return obra.nombreObra;
    }

    // Probar con 'nombre' (podría ser el campo correcto)
    if (obra.nombre && obra.nombre.trim() !== '' && obra.nombre.trim() !== 'Casa Completa') {
      return obra.nombre;
    }

    // También probar con nombre_obra (snake_case)
    if (obra.nombre_obra && obra.nombre_obra.trim() !== '' && obra.nombre_obra.trim() !== 'Casa Completa') {
      return obra.nombre_obra;
    }

    // PRIORIDAD 2: Formatear dirección completa si no hay nombre de obra
    const partes = [];

    // Intentar formatear con campos detallados usando snake_case (de la BD)
    // Orden: barrio, calle, altura, torre, piso, departamento
    if (obra.direccion_obra_barrio) partes.push(`(${obra.direccion_obra_barrio})`);
    if (obra.direccion_obra_calle) partes.push(obra.direccion_obra_calle);
    if (obra.direccion_obra_altura) partes.push(obra.direccion_obra_altura);
    if (obra.direccion_obra_torre) partes.push(`Torre ${obra.direccion_obra_torre}`);
    if (obra.direccion_obra_piso) partes.push(`Piso ${obra.direccion_obra_piso}`);
    if (obra.direccion_obra_departamento) partes.push(`Depto ${obra.direccion_obra_departamento}`);

    // Si tiene dirección detallada snake_case, usarla
    if (partes.length > 0) {
      return partes.join(' ');
    }

    // Intentar con camelCase (por si el backend lo devuelve así)
    if (obra.direccionObraBarrio) partes.push(`(${obra.direccionObraBarrio})`);
    if (obra.direccionObraCalle) partes.push(obra.direccionObraCalle);
    if (obra.direccionObraAltura) partes.push(obra.direccionObraAltura);
    if (obra.direccionObraTorre) partes.push(`Torre ${obra.direccionObraTorre}`);
    if (obra.direccionObraPiso) partes.push(`Piso ${obra.direccionObraPiso}`);
    if (obra.direccionObraDepartamento) partes.push(`Depto ${obra.direccionObraDepartamento}`);

    if (partes.length > 0) {
      return partes.join(' ');
    }

    // Intentar con campos simples (calle, altura, barrio, etc.)
    if (obra.barrio) partes.push(`(${obra.barrio})`);
    if (obra.calle) partes.push(obra.calle);
    if (obra.altura) partes.push(obra.altura);
    if (obra.torre) partes.push(`Torre ${obra.torre}`);
    if (obra.piso) partes.push(`Piso ${obra.piso}`);
    if (obra.departamento || obra.depto) partes.push(`Depto ${obra.departamento || obra.depto}`);

    if (partes.length > 0) {
      return partes.join(' ');
    }

    // PRIORIDAD 3: Usar direccionObra (campo de la tabla Obra tradicional)
    if (obra.direccionObra && obra.direccionObra.trim() !== '') {
      return obra.direccionObra;
    }

    // PRIORIDAD 4: Si es "Casa Completa" (nombre por defecto), también mostrar
    if (obra.nombreObra && obra.nombreObra.trim() !== '') {
      return obra.nombreObra;
    }

    // Último recurso: ID
    return `Obra #${obra.id}`;
  };

  // Solo aplicar el value cuando ya se cargaron las obras
  const valorActual = (loading || obras.length === 0) ? '' : (value ? String(value) : '');

  return (
    <select
      className={className}
      value={valorActual}
      onChange={e => onChange(e.target.value)}
      onClick={onClick}
      required={required}
      disabled={!empresaId || disabled}
      style={style}
    >
      <option value="">{!empresaId ? 'Seleccione primero una empresa' : (obras.length === 0 ? 'No hay obras disponibles' : placeholder)}</option>
      {obras.map(obra => (
        <option key={`obra-${obra.id}`} value={String(obra.id)}>
          {obra.esTrabajoExtra ? '🔧 ' : ''}{formatearDireccionObra(obra)}
        </option>
      ))}
    </select>
  );
};

export default ObraSelector;
