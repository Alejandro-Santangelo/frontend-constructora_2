import React, { useState } from 'react';
import { Spinner, Alert, Table, Badge, Button } from 'react-bootstrap';
import api from '../services/api';
import { useEmpresa } from '../EmpresaContext';
import { calcularTotalConDescuentosDesdeItems } from '../utils/presupuestoDescuentosUtils';

/**
 * Modal para listar TODOS los presupuestos NoCliente de una empresa
 * y permitir seleccionar uno para editar
 */
const ListarTodosPresupuestosModal = ({ show, handleClose, onSeleccionarPresupuesto }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);

  // Cargar todos los presupuestos al abrir el modal
  React.useEffect(() => {
    if (show && empresaSeleccionada) {
      handleBuscarPresupuestos();
    }
  }, [show, empresaSeleccionada]);

  const handleBuscarPresupuestos = async () => {
    if (!empresaSeleccionada) {
      setError('Debe seleccionar una empresa');
      return;
    }

    setLoading(true);
    setError(null);
    setPresupuestos([]);

    try {
      console.log('📋 Buscando TODOS los presupuestos para empresa:', empresaSeleccionada.id);
      
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);

      console.log('✅ Presupuestos encontrados:', response);
      
      // El backend puede devolver directamente un array o un objeto paginado con 'content'
      let presupuestosArray = [];
      
      if (Array.isArray(response)) {
        presupuestosArray = response;
      } else if (response.content && Array.isArray(response.content)) {
        presupuestosArray = response.content;
      } else if (response.data) {
        if (Array.isArray(response.data)) {
          presupuestosArray = response.data;
        } else if (response.data.content && Array.isArray(response.data.content)) {
          presupuestosArray = response.data.content;
        }
      } else if (response.datos && Array.isArray(response.datos)) {
        presupuestosArray = response.datos;
      }
      
      // 🔥 CARGAR itemsCalculadora para cada presupuesto (datos reales, NO hardcodeados)
      console.log('📊 Cargando datos completos para', presupuestosArray.length, 'presupuestos...');
      
      // Función auxiliar para cargar presupuesto con retry
      const cargarPresupuestoConReintento = async (p, maxIntentos = 2) => {        
        for (let intento = 1; intento <= maxIntentos; intento++) {
          try {
            console.log(`🔄 Cargando presupuesto ${p.id}... (intento ${intento})`);
            const completo = await api.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id);
            
            // Si los datos vienen con flag de error, usar datos originales
            if (completo._errorBackend) {
              console.warn(`⚠️ Backend error en presupuesto ${p.id}, usando datos de lista`);
              return { ...p, _errorBackend: true };
            }
            
            return completo;
          } catch (err) {
            if (err.status === 400 && intento < maxIntentos) {
              console.warn(`⚠️ Error 400 en presupuesto ${p.id}, reintentando en 500ms...`);
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
            throw err; // Re-lanzar el error después de todos los intentos
          }
        }
      };
      
      // ⚡ Usar carga secuencial para evitar errores 400 por sobrecarga del backend
      const presupuestosCompletos = [];
      for (const p of presupuestosArray) {
        try {
          // Solo cargar datos completos si no están ya disponibles
          if (p.itemsCalculadora && Array.isArray(p.itemsCalculadora)) {
            console.log(`✅ Presupuesto ${p.id} ya tiene datos completos`);
            presupuestosCompletos.push(p);
          } else {
            const completo = await cargarPresupuestoConReintento(p);
            presupuestosCompletos.push(completo);
          }
        } catch (err) {
          // Silenciar errores 400 específicos que no afectan la funcionalidad
          if (err.status === 400 && p.id) {
            console.warn(`⚠️ Error 400 persistente en presupuesto ${p.id}, usando datos básicos`);
          } else {
            console.error(`❌ Error cargando presupuesto ${p.id}:`, err);
            console.error(`❌ Error details:`, {
              status: err.status,
              message: err.message,
              data: err.data
            });
          }
          presupuestosCompletos.push(p); // Fallback al presupuesto sin itemsCalculadora
        }
        // Pequeña pausa para no sobrecargar el backend
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Ordenar por numeroPresupuesto (desc) y luego por numeroVersion (desc)
      // Esto mostrará primero el presupuesto más reciente, y dentro de cada grupo
      // la versión más alta primero
      const ordenados = presupuestosCompletos.sort((a, b) => {
        // Primero por número de presupuesto (descendente)
        const numPresupuestoA = Number(a.numeroPresupuesto || 0);
        const numPresupuestoB = Number(b.numeroPresupuesto || 0);
        
        if (numPresupuestoB !== numPresupuestoA) {
          return numPresupuestoB - numPresupuestoA;
        }
        
        // Si tienen el mismo número de presupuesto, ordenar por versión (descendente)
        const versionA = Number(a.numeroVersion || a.version || 0);
        const versionB = Number(b.numeroVersion || b.version || 0);
        return versionB - versionA;
      });
      
      console.log('📊 Presupuestos ordenados:', ordenados.map(p => ({
        id: p.id,
        num: p.numeroPresupuesto,
        ver: p.numeroVersion || p.version
      })));
      
      setPresupuestos(ordenados);
    } catch (err) {
      console.error('❌ Error buscando presupuestos:', err);
      console.error('❌ Error completo:', {
        message: err.message,
        response: err.response,
        status: err.status,
        data: err.response?.data
      });
      
      let mensajeError = 'Error al cargar presupuestos';
      
      if (err.status === 404 || err.message?.includes('404')) {
        mensajeError = 'No se encontraron presupuestos para esta empresa';
        setPresupuestos([]);
      } else if (err.response?.data?.mensaje) {
        mensajeError = err.response.data.mensaje;
      } else if (err.message) {
        mensajeError = err.message;
      }
      
      setError(mensajeError);
      console.error('📢 Mostrando error al usuario:', mensajeError);
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccionar = (presupuesto) => {
    console.log('✅ Presupuesto seleccionado:', presupuesto);
    if (onSeleccionarPresupuesto) {
      onSeleccionarPresupuesto(presupuesto);
    }
    handleClose();
  };

  const handleEliminar = async (presupuesto, event) => {
    // Prevenir que se abra el presupuesto al hacer clic en eliminar
    event.stopPropagation();
    
    // Validar si está aprobado y tiene obra asociada
    if (presupuesto.estado === 'APROBADO' && presupuesto.obraId) {
      const confirmar = window.confirm(
        `⚠️ ADVERTENCIA\n\n` +
        `Este presupuesto está APROBADO y tiene una obra asociada (ID: ${presupuesto.obraId}).\n\n` +
        `No se puede eliminar sin desvincular la obra primero.`
      );
      return;
    }
    
    // Mensaje de confirmación
    let mensaje = `¿Está seguro de eliminar este presupuesto?\n\n`;
    mensaje += `ID: ${presupuesto.id}\n`;
    mensaje += `Presupuesto #${presupuesto.numeroPresupuesto} versión ${presupuesto.numeroVersion}\n`;
    mensaje += `Estado: ${presupuesto.estado}\n`;
    
    if (presupuesto.estado === 'APROBADO') {
      mensaje += `\n⚠️ Este presupuesto está APROBADO. Esta acción no se puede deshacer.`;
    }
    
    const confirmar = window.confirm(mensaje);
    if (!confirmar) return;
    
    setLoading(true);
    try {
      await api.presupuestosNoCliente.delete(presupuesto.id, empresaSeleccionada.id);
      console.log('✅ Presupuesto eliminado:', presupuesto.id);
      
      // Recargar la lista
      await handleBuscarPresupuestos();
      
      alert('✅ Presupuesto eliminado correctamente');
    } catch (error) {
      console.error('❌ Error al eliminar presupuesto:', error);
      const errorMsg = error.response?.data?.mensaje || error.response?.data?.message || error.message || 'Error desconocido';
      
      // Manejar error 409 (Conflict - tiene dependencias)
      if (error.response?.status === 409) {
        const obraId = error.response?.data?.obraId;
        
        // Mensaje detallado sobre el conflicto de integridad
        let mensajeDetallado = '⚠️ NO SE PUEDE ELIMINAR ESTE PRESUPUESTO\n\n';
        mensajeDetallado += 'Motivo: El presupuesto tiene datos relacionados que impiden su eliminación.\n\n';
        mensajeDetallado += 'Posibles causas:\n';
        mensajeDetallado += '• Tiene profesionales asignados\n';
        mensajeDetallado += '• Tiene materiales asociados\n';
        mensajeDetallado += '• Tiene PDFs cargados\n';
        mensajeDetallado += '• Tiene items agregados\n';
        mensajeDetallado += '• Está vinculado a una obra\n';
        mensajeDetallado += '• Tiene historial de versiones\n\n';
        mensajeDetallado += '💡 Opciones:\n';
        mensajeDetallado += '1. Cambiar el estado a "RECHAZADO" o "BORRADOR"\n';
        mensajeDetallado += '2. Contactar al administrador para eliminar las dependencias\n';
        mensajeDetallado += '3. Dejar el presupuesto como histórico (no eliminarlo)';
        
        alert(mensajeDetallado);
      } else {
        alert('❌ Error al eliminar: ' + errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    try {
      return new Date(fecha).toLocaleDateString('es-AR');
    } catch {
      return fecha;
    }
  };

  const formatearMonto = (monto) => {
    if (!monto && monto !== 0) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto);
  };

  const getBadgeEstado = (estado) => {
    const estadoUpper = (estado || '').toUpperCase();
    switch (estadoUpper) {
      case 'APROBADO':
        return <Badge bg="success">APROBADO</Badge>;
      case 'RECHAZADO':
        return <Badge bg="danger">RECHAZADO</Badge>;
      case 'EN REVISION':
        return <Badge bg="warning" text="dark">EN REVISION</Badge>;
      case 'A ENVIAR':
        return <Badge bg="info">A ENVIAR</Badge>;
      case 'PENDIENTE':
        return <Badge bg="secondary">PENDIENTE</Badge>;
      default:
        return <Badge bg="secondary">{estado || 'SIN ESTADO'}</Badge>;
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ zIndex: 2000 }}>
      <div className="modal-dialog modal-xl" style={{ marginTop: '80px', maxWidth: '95vw' }}>
        <div className="modal-content">
          <div className="modal-header" style={{ backgroundColor: '#f8f9fa' }}>
            <h5 className="modal-title">
              📋 Todos los Presupuestos NoCliente
              {empresaSeleccionada && (
                <small className="text-muted ms-2">
                  ({empresaSeleccionada.nombreEmpresa})
                </small>
              )}
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={handleClose}>
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Botón para recargar */}
        <div className="mb-3 d-flex justify-content-between align-items-center">
          <Button 
            variant="primary" 
            onClick={handleBuscarPresupuestos}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Cargando...
              </>
            ) : (
              '🔄 Recargar'
            )}
          </Button>
          
          <span className="text-muted">
            {presupuestos.length} presupuesto(s) encontrado(s)
          </span>
        </div>

        {/* Mensajes de error */}
        {error && (
          <Alert variant="warning" className="mb-3">
            ⚠️ {error}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Cargando...</span>
            </Spinner>
            <p className="mt-3 text-muted">Cargando presupuestos...</p>
          </div>
        )}

        {/* Tabla de presupuestos */}
        {!loading && presupuestos.length > 0 && (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '70px' }}>Nro/Ver</th>
                <th style={{ width: '120px' }}>Dirección Obra</th>
                <th style={{ width: '140px', background: '#ffeeba', color: '#222' }}>Nombre de Obra</th>
                <th style={{ width: '110px' }}>Solicitante</th>
                <th style={{ width: '80px' }}>Estado</th>
                <th style={{ width: '70px' }}>Obra ID</th>
                <th style={{ width: '100px' }}>Fecha Creación</th>
                <th style={{ width: '100px' }}>Monto Total</th>
                <th style={{ width: '80px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {presupuestos.map((presupuesto) => {
                const direccionCompleta = [
                  presupuesto.direccionObraCalle,
                  presupuesto.direccionObraAltura,
                  presupuesto.direccionObraPiso ? `Piso ${presupuesto.direccionObraPiso}` : '',
                  presupuesto.direccionObraDepartamento ? `Dpto ${presupuesto.direccionObraDepartamento}` : ''
                ].filter(Boolean).join(' ');

                // Obtener el nombre de la obra usando selectObraById si está disponible
                // Obtener el nombre de la obra usando selectObraById si está disponible
                let nombreObra = '-';
                if (typeof window !== 'undefined' && window.selectObraById && presupuesto.obraId) {
                  const obra = window.selectObraById(presupuesto.obraId);
                  nombreObra = obra?.nombreObra || obra?.nombre || '-';
                } else if (presupuesto.nombreObra) {
                  nombreObra = presupuesto.nombreObra;
                } else if (presupuesto.obraNombre) {
                  nombreObra = presupuesto.obraNombre;
                }
                return (
                  <tr key={presupuesto.id}>
                    <td className="text-center">{presupuesto.id}</td>
                    <td className="text-center">
                      <small>
                        #{presupuesto.numeroPresupuesto || '-'}<br />
                        v{presupuesto.numeroVersion || presupuesto.version || 1}
                      </small>
                    </td>
                    <td>
                      <strong>{direccionCompleta || 'Sin dirección'}</strong>
                      {presupuesto.descripcion && (
                        <div><small className="text-muted">{presupuesto.descripcion}</small></div>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: '#d35400' }}>{nombreObra}</strong>
                    </td>
                    <td>
                      {presupuesto.nombreSolicitante || '-'}
                      {presupuesto.telefono && (
                        <div><small className="text-muted">Tel: {presupuesto.telefono}</small></div>
                      )}
                    </td>
                    <td className="text-center">
                      {getBadgeEstado(presupuesto.estado)}
                    </td>
                    <td className="text-center">
                      {presupuesto.obraId ? (
                        <Badge bg="success" title="Presupuesto asociado a obra">
                          🏗️ {presupuesto.obraId}
                        </Badge>
                      ) : (
                        <Badge bg="secondary" title="Sin obra asociada">
                          -
                        </Badge>
                      )}
                    </td>
                    <td className="text-center">
                      {formatearFecha(presupuesto.fechaCreacion)}
                    </td>
                    <td className="text-end">
                      <strong>
                        {(() => {
                          // 🔥 CALCULAR TOTAL DINÁMICAMENTE DESDE LOS ITEMS Y DESCUENTOS
                          // Esto asegura que el total mostrado siempre refleje los cambios actuales
                          
                          // Si el presupuesto tiene itemsCalculadora, calcular dinámicamente
                          if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
                            try {
                              const resultado = calcularTotalConDescuentosDesdeItems(
                                presupuesto.itemsCalculadora,
                                presupuesto // Los descuentos están en el objeto presupuesto
                              );
                              
                              return formatearMonto(resultado.totalFinal);
                            } catch (error) {
                              console.error('❌ Error calculando total para presupuesto', presupuesto.id, error);
                              // Fallback al valor del backend si hay error
                              const totalFallback = presupuesto.totalPresupuestoConHonorarios || 
                                                    presupuesto.totalFinal || 
                                                    presupuesto.montoTotal;
                              return totalFallback ? formatearMonto(totalFallback) : <span className="text-muted">Error</span>;
                            }
                          }
                          
                          // Si no tiene items aún cargados, usar valor del backend como fallback
                          const totalFallback = presupuesto.totalPresupuestoConHonorarios || 
                                                presupuesto.totalFinal || 
                                                presupuesto.montoTotal;
                          
                          if (totalFallback && totalFallback > 0) {
                            return formatearMonto(totalFallback);
                          }
                          
                          return <span className="text-muted">Cargando...</span>;
                        })()}
                      </strong>
                    </td>
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        <Button
                          variant={presupuesto._errorBackend ? "warning" : "primary"}
                          size="sm"
                          onClick={() => handleSeleccionar(presupuesto)}
                          title={presupuesto._errorBackend ? "⚠️ Presupuesto con datos limitados" : "Abrir presupuesto"}
                        >
                          {presupuesto._errorBackend ? "⚠️ Abrir" : "📝 Abrir"}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => handleEliminar(presupuesto, e)}
                          title="Eliminar presupuesto"
                          disabled={loading}
                        >
                          🗑️
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {/* Sin resultados */}
        {!loading && presupuestos.length === 0 && !error && (
          <Alert variant="info" className="text-center">
            <p className="mb-0">
              ℹ️ No se encontraron presupuestos para esta empresa.
            </p>
          </Alert>
        )}
      </div>

      <div className="modal-footer">
        <Button variant="secondary" onClick={handleClose}>
          Cerrar
        </Button>
      </div>
    </div>
    </div>
    </div>
  );
};

export default ListarTodosPresupuestosModal;
