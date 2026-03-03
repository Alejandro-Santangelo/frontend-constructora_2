import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';

/**
 * Componente que muestra el estado del presupuesto APROBADO de una obra
 */
const EstadoPresupuestoBadge = ({ obraId, estadoObra }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (obraId && empresaSeleccionada) {
      cargarEstadoPresupuesto();
    }
  }, [obraId, empresaSeleccionada]);

  const cargarEstadoPresupuesto = async () => {
    setCargando(true);
    try {
      const response = await fetch(
        `http://localhost:8080/api/presupuestos-no-cliente/por-obra/${obraId}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        setEstado(null);
        setCargando(false);
        return;
      }

      let presupuestoData = await response.json();

      // Si no es array, convertir a array
      if (!Array.isArray(presupuestoData)) {
        presupuestoData = [presupuestoData];
      }

      // Agrupar por numeroPresupuesto y seleccionar solo estados válidos
      // Estados válidos: APROBADO, EN_EJECUCION, SUSPENDIDO, CANCELADO, TERMINADO, FINALIZADO
      const ESTADOS_VALIDOS = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDO', 'CANCELADO', 'TERMINADO', 'FINALIZADO'];

      let presupuesto = null;
      if (Array.isArray(presupuestoData) && presupuestoData.length > 0) {
        const porNumero = {};
        presupuestoData.forEach(p => {
          const num = p.numeroPresupuesto;
          if (!porNumero[num]) porNumero[num] = [];
          porNumero[num].push(p);
        });

        const presupuestosValidos = [];
        Object.values(porNumero).forEach(versiones => {
          const validos = versiones.filter(p => ESTADOS_VALIDOS.includes(p.estado));

          if (validos.length > 0) {
            validos.sort((a, b) => {
              const vA = a.numeroVersion || a.version || 0;
              const vB = b.numeroVersion || b.version || 0;
              return vB - vA;
            });
            presupuestosValidos.push(validos[0]);
          }
        });

        presupuesto = presupuestosValidos.length > 0 ? presupuestosValidos[0] : null;
      }

      setEstado(presupuesto?.estado || null);
    } catch (error) {
      console.error('Error cargando estado presupuesto:', error);
      setEstado(null);
    } finally {
      setCargando(false);
    }
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'BORRADOR': return 'bg-secondary';
      case 'A_ENVIAR': return 'bg-info';
      case 'ENVIADO': return 'bg-primary';
      case 'APROBADO': return 'bg-success';
      case 'EN_EJECUCION': return 'bg-success';
      case 'SUSPENDIDO': return 'bg-warning';
      case 'CANCELADO': return 'bg-danger';
      case 'MODIFICADO': return 'bg-dark';
      case 'RECHAZADO': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  if (cargando) {
    return (
      <span className="badge bg-secondary">
        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
        Cargando...
      </span>
    );
  }

  if (!estado) {
    // Si hay estado de obra, mostrarlo en lugar del mensaje genérico
    if (estadoObra) {
      const mapeoEstados = {
        'BORRADOR': { label: 'Borrador', class: 'bg-secondary' },
        'A_ENVIAR': { label: 'A enviar', class: 'bg-info' },
        'ENVIADO': { label: 'Enviado', class: 'bg-primary' },
        'APROBADO': { label: 'Aprobado', class: 'bg-success' },
        'OBRA_A_CONFIRMAR': { label: 'Obra a confirmar', class: 'bg-warning text-dark' },
        'MODIFICADO': { label: 'Modificado', class: 'bg-warning' },
        'EN_EJECUCION': { label: 'En ejecución', class: 'bg-info' },
        'TERMINADO': { label: 'Terminado', class: 'bg-dark' },
        'CANCELADO': { label: 'Cancelado', class: 'bg-danger' },
        'SUSPENDIDO': { label: 'Suspendido', class: 'bg-warning' },
        'INACTIVA': { label: 'Inactiva', class: 'bg-secondary' }
      };

      const estadoInfo = mapeoEstados[estadoObra] || { label: estadoObra, class: 'bg-secondary' };

      return (
        <span className={`badge ${estadoInfo.class}`}>
          {estadoInfo.label}
        </span>
      );
    }

    return (
      <span className="badge bg-warning text-dark">
        Presupuesto Abreviado
      </span>
    );
  }

  return (
    <span className={`badge ${getEstadoBadgeClass(estado)}`}>
      {estado}
    </span>
  );
};

export default EstadoPresupuestoBadge;
