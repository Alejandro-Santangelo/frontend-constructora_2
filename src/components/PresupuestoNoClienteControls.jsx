import React, { useState } from 'react';
import PresupuestoNoClienteModal from './PresupuestoNoClienteModal';
import BuscarPresupuestoNoClienteModal from './BuscarPresupuestoNoClienteModal';
import ListarTodosPresupuestosNoClienteModal from './ListarTodosPresupuestosNoClienteModal';
import apiService from '../services/api';
import { useEmpresa } from '../EmpresaContext';

const PresupuestoNoClienteControls = ({ selectedId, onRefresh, showNotification, selectedPresupuesto }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [showModal, setShowModal] = useState(false);
  const [showBuscarModal, setShowBuscarModal] = useState(false);
  const [showListarTodosModal, setShowListarTodosModal] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [direccionBusqueda, setDireccionBusqueda] = useState(null); // Guarda los datos de búsqueda para el update
  const [loadingAction, setLoadingAction] = useState(null); // 'new'|'edit'|'delete'|'approve'|'assign'|'duplicate'|'save'|'buscar'|'verify'
  const [confirmState, setConfirmState] = useState({ show: false, action: null, payload: null });

  const empresaId = empresaSeleccionada ? empresaSeleccionada.id : null;

  // ✅ Detectar si el presupuesto seleccionado tiene obra asociada
  const tieneObraAsociada = selectedPresupuesto?.obraId !== null && selectedPresupuesto?.obraId !== undefined;

  const handleNew = () => {
    setEditingData(null);
    setShowModal(true);
  };

  const handleEdit = () => {
    // Abrir modal de búsqueda
    setShowBuscarModal(true);
  };

  const handleListarTodos = () => {
    setShowListarTodosModal(true);
  };

  const handleBuscarYEditar = async (dataBusqueda) => {
    setLoadingAction('buscar');
    try {
      setDireccionBusqueda(dataBusqueda);
      setShowBuscarModal(false);

      // Backend filtra automáticamente con Hibernate Filter
      const allPresupuestos = await apiService.presupuestosNoCliente.getAll();
      const lista = Array.isArray(allPresupuestos) ? allPresupuestos : (allPresupuestos.datos || allPresupuestos.content || []);

      // Filtrar por dirección (calle y altura)
      const candidatos = lista.filter(p => {
        const calleMatch = String(p.direccionObraCalle || '').trim().toLowerCase() === String(dataBusqueda.direccionObraCalle || '').trim().toLowerCase();
        const alturaMatch = String(p.direccionObraAltura || '').trim() === String(dataBusqueda.direccionObraAltura || '').trim();
        return calleMatch && alturaMatch;
      });

      let encontrado;

      if (dataBusqueda.numeroVersion) {
        // Si se especificó versión, buscar exactamente esa versión
        encontrado = candidatos.find(p => Number(p.numeroVersion) === Number(dataBusqueda.numeroVersion));
      } else {
        // Si NO se especificó versión, tomar la versión más reciente (mayor número)
        if (candidatos.length > 0) {
          encontrado = candidatos.reduce((max, p) =>
            Number(p.numeroVersion) > Number(max.numeroVersion) ? p : max
          );
        }
      }

      if (!encontrado) {
        showNotification('No se encontró ningún presupuesto con esos datos', 'warning');
        setLoadingAction(null);
        return;
      }

      // Determinar si es la última versión (para permitir edición)
      const versionMasReciente = candidatos.reduce((max, p) =>
        Number(p.numeroVersion) > Number(max.numeroVersion) ? p : max
      , candidatos[0]);

      const esUltimaVersion = Number(encontrado.numeroVersion) === Number(versionMasReciente.numeroVersion);

      // Agregar flag de solo lectura al objeto encontrado
      encontrado._soloLectura = !esUltimaVersion;

      setEditingData(encontrado);
      setShowModal(true);

      if (esUltimaVersion) {
        showNotification(`Presupuesto encontrado: Nro ${encontrado.numeroPresupuesto} - Versión ${encontrado.numeroVersion} (editable)`, 'info');
      } else {
        showNotification(`Presupuesto encontrado: Nro ${encontrado.numeroPresupuesto} - Versión ${encontrado.numeroVersion} (solo lectura - versión anterior)`, 'warning');
      }
    } catch (err) {
      showNotification(err.message || 'Error al buscar presupuesto', 'danger');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      return showNotification('Seleccione un presupuesto para eliminar', 'warning');
    }

    try {
      // Obtener el presupuesto para validar su estado y asociación con una obra
      const presupuesto = await apiService.presupuestosNoCliente.getById(selectedId, empresaId);

      if (presupuesto.estado === 'APROBADO' && presupuesto.obraId) {
        // Advertencia especial para presupuestos con obra asociada
        const confirmar = window.confirm(
          `⚠️ ELIMINACIÓN EN CASCADA\n\n` +
          `Este presupuesto está APROBADO y vinculado a la Obra ID: ${presupuesto.obraId}\n\n` +
          `Se eliminará:\n` +
          `✓ Todos los pagos a profesionales\n` +
          `✓ Todas las asistencias registradas\n` +
          `✓ Las asignaciones profesional-obra\n` +
          `✓ El presupuesto\n\n` +
          `NO se eliminará:\n` +
          `✗ La obra (ID: ${presupuesto.obraId})\n` +
          `✗ El cliente asociado\n` +
          `✗ La empresa\n\n` +
          `⚠️ ADVERTENCIA: La obra quedará sin presupuesto asociado.\n\n` +
          `¿Desea continuar con la eliminación?`
        );

        if (!confirmar) {
          return; // Cancelar eliminación
        }

        // Ejecutar eliminación en cascada directamente
        await execDelete(selectedId);
      } else {
        // Para presupuestos no aprobados, usar el flujo de confirmación normal
        setConfirmState({ show: true, action: 'delete', payload: { id: selectedId } });
      }
    } catch (err) {
      console.error('Error al validar el presupuesto:', err);
      showNotification('Error al validar el presupuesto para eliminar', 'danger');
    }
  };

  const execDelete = async (id) => {
    setConfirmState({ show: false, action: null, payload: null });
    setLoadingAction('delete');
    try {
      console.log('🗑️ Iniciando eliminación en cascada del presupuesto:', id);

      // 1. Obtener el presupuesto para saber qué profesionalObraId eliminar
      const presupuesto = await apiService.presupuestosNoCliente.getById(id, empresaId);
      console.log('📋 Presupuesto a eliminar:', presupuesto);

      // 2. Obtener profesionalObraId únicos de los items de calculadora
      const profesionalObraIds = new Set();
      if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
        presupuesto.itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              if (prof.profesionalObraId) {
                profesionalObraIds.add(prof.profesionalObraId);
              }
            });
          }
        });
      }

      console.log('👷 ProfesionalObraIds a eliminar:', Array.from(profesionalObraIds));

      let totalPagosEliminados = 0;
      let totalAsistenciasEliminadas = 0;

      // 3. Eliminar pagos de cada profesionalObraId
      for (const profesionalObraId of profesionalObraIds) {
        try {
          console.log(`💸 Eliminando pagos del profesionalObraId: ${profesionalObraId}`);

          // Usar el servicio importado directamente
          const { listarPagosPorProfesional, eliminarPago } = await import('../services/pagosProfesionalObraService.js');

          const empresaId = JSON.parse(sessionStorage.getItem('empresaSeleccionada'))?.id;
          const pagos = await listarPagosPorProfesional(profesionalObraId, empresaId);
          const pagosArray = Array.isArray(pagos) ? pagos : [];

          for (const pago of pagosArray) {
            console.log(`  🗑️ Eliminando pago ID: ${pago.id}`);
            await eliminarPago(pago.id, empresaId);
            totalPagosEliminados++;
          }

          console.log(`✅ ${pagosArray.length} pago(s) eliminado(s) del profesionalObraId ${profesionalObraId}`);
        } catch (err) {
          console.warn(`⚠️ Error al eliminar pagos del profesionalObraId ${profesionalObraId}:`, err);
          // Continuar con la eliminación aunque falle algún pago
        }
      }

      // 4. Eliminar asistencias (si el servicio existe)
      if (apiService.asistencias) {
        for (const profesionalObraId of profesionalObraIds) {
          try {
            console.log(`📅 Eliminando asistencias del profesionalObraId: ${profesionalObraId}`);
            const asistencias = await apiService.asistencias.listarAsistenciasPorProfesional(profesionalObraId);
            const asistenciasArray = Array.isArray(asistencias) ? asistencias : [];

            for (const asistencia of asistenciasArray) {
              console.log(`  🗑️ Eliminando asistencia ID: ${asistencia.id}`);
              await apiService.asistencias.eliminarAsistencia(asistencia.id);
              totalAsistenciasEliminadas++;
            }

            console.log(`✅ ${asistenciasArray.length} asistencia(s) eliminada(s) del profesionalObraId ${profesionalObraId}`);
          } catch (err) {
            console.warn(`⚠️ Error al eliminar asistencias del profesionalObraId ${profesionalObraId}:`, err);
            // Continuar con la eliminación aunque falle alguna asistencia
          }
        }
      }

      // 5. Eliminar asignaciones profesional-obra (profesionales_obras)
      console.log('👷 Eliminando asignaciones profesional-obra...');
      let totalAsignacionesEliminadas = 0;

      for (const profesionalObraId of profesionalObraIds) {
        try {
          console.log(`  🗑️ Eliminando profesional-obra ID: ${profesionalObraId}`);

          // Llamar al endpoint DELETE del backend para profesionales-obra
          if (apiService.profesionalesObra && apiService.profesionalesObra.delete) {
            await apiService.profesionalesObra.delete(profesionalObraId, empresaId);
            totalAsignacionesEliminadas++;
            console.log(`  ✅ Profesional-obra ${profesionalObraId} eliminado`);
          } else {
            console.warn('⚠️ Servicio profesionalesObra.delete no disponible');
          }
        } catch (err) {
          console.warn(`⚠️ Error al eliminar profesional-obra ${profesionalObraId}:`, err);
          // Continuar aunque falle
        }
      }

      console.log(`✅ ${totalAsignacionesEliminadas} asignación(es) profesional-obra eliminada(s)`);

      // 6. Finalmente, eliminar el presupuesto (la obra NO se elimina)
      console.log('🗑️ Eliminando presupuesto (la obra permanece)...');
      await apiService.presupuestosNoCliente.delete(id);

      console.log('✅ Eliminación en cascada completada exitosamente');

      const mensaje = `Presupuesto eliminado exitosamente\n` +
        `${totalPagosEliminados > 0 ? `💸 ${totalPagosEliminados} pago(s) eliminado(s)\n` : ''}` +
        `${totalAsistenciasEliminadas > 0 ? `📅 ${totalAsistenciasEliminadas} asistencia(s) eliminada(s)\n` : ''}` +
        `${totalAsignacionesEliminadas > 0 ? `👷 ${totalAsignacionesEliminadas} asignación(es) profesional-obra eliminada(s)\n` : ''}` +
        `\n⚠️ Nota: La obra asociada NO fue eliminada`;

      showNotification(mensaje, 'success');
      onRefresh && onRefresh();
    } catch (err) {
      console.error('❌ Error en eliminación en cascada:', err);
      showNotification(err.message || 'Error al eliminar', 'danger');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApprove = async () => {
    console.log('🔵 handleApprove iniciado');
    console.log('🔵 selectedId:', selectedId);

    if (!selectedId) return showNotification('Seleccione un presupuesto para aprobar', 'warning');

    // Obtener el presupuesto seleccionado para extraer clienteId y obraId
    let presupuestoActual = null;
    try {
      console.log('🔍 Obteniendo datos del presupuesto:', selectedId);
      presupuestoActual = await apiService.presupuestosNoCliente.getById(selectedId, empresaId);
      console.log('✅ Presupuesto obtenido:', presupuestoActual);
    } catch (error) {
      console.warn('⚠️ No se pudo obtener datos del presupuesto:', error);
    }

    // Confirmar acción
    const confirmar = window.confirm(
      '🏗️ APROBAR Y CREAR OBRA\n\n' +
      '¿Está seguro de aprobar este presupuesto?\n\n' +
      '✅ Se marcará como "Aprobado"\n' +
      '🏢 Se creará una nueva obra automáticamente\n' +
      (presupuestoActual?.clienteId ? '♻️ Se reutilizará el cliente existente\n' : '👤 Se creará un cliente nuevo\n') +
      '📍 Nombre de obra: ' + (presupuestoActual?.nombreObra || 'Dirección del presupuesto') + '\n\n' +
      '¿Desea continuar?'
    );

    console.log('🔵 Usuario confirmó:', confirmar);
    if (!confirmar) return;

    setLoadingAction('approve');
    try {
      // Usar el nuevo endpoint con parámetros opcionales
      // Buscar clienteId en todas las variantes posibles
      const clienteId = presupuestoActual?.clienteId ||
                       presupuestoActual?.idCliente ||
                       presupuestoActual?.cliente_id ||
                       presupuestoActual?.client_id ||
                       null;
      const obraId = presupuestoActual?.obraId ||
                    presupuestoActual?.idObra ||
                    presupuestoActual?.obra_id ||
                    null;

      console.log('📤 Llamando a aprobarYCrearObra con:');
      console.log('   - selectedId:', selectedId);
      console.log('   - clienteId:', clienteId);
      console.log('   - obraId:', obraId);
      console.log('   - presupuestoActual completo:', presupuestoActual);

      const resultado = await apiService.presupuestosNoCliente.aprobarYCrearObra(
        selectedId,
        clienteId,    // clienteReferenciaId
        obraId        // obraReferenciaId
      );

      console.log('✅ Respuesta del backend:', resultado);

      // Mensaje de éxito detallado
      const mensaje = `
✅ ¡Presupuesto aprobado exitosamente!

🏗️ Obra creada: ID ${resultado.obraId}
${resultado.clienteReutilizado ? '♻️ Cliente reutilizado' : '🆕 Cliente nuevo creado'}: ID ${resultado.clienteId || 'N/A'}
📋 Presupuestos actualizados: ${resultado.presupuestosActualizados}
${resultado.mensaje ? '\n📝 ' + resultado.mensaje : ''}
      `.trim();

      showNotification(mensaje, 'success');

      onRefresh && onRefresh();
    } catch (err) {
      console.error('❌ Error al aprobar y crear obra:', err);
      console.error('❌ Error completo:', JSON.stringify(err, null, 2));
      console.error('❌ Error response:', err.response);
      console.error('❌ Error response data:', err.response?.data);

      let mensajeError = err.response?.data?.message || err.response?.data?.mensaje || err.message || 'Error desconocido';

      // Detectar error específico de obra ya asociada
      if (mensajeError.includes('ya tiene una obra asociada')) {
        const obraIdMatch = mensajeError.match(/ID:\s*(\d+)/);
        const obraId = obraIdMatch ? obraIdMatch[1] : 'desconocido';

        mensajeError = `⚠️ Este presupuesto ya fue aprobado anteriormente y tiene una obra asociada (ID: ${obraId}).\n\n` +
                      `No se puede aprobar nuevamente.\n\n` +
                      `Opciones:\n` +
                      `• Crear un nuevo presupuesto desde cero\n` +
                      `• Duplicar este presupuesto (creará una nueva versión sin obra)\n` +
                      `• Editar el presupuesto existente en la obra asociada`;
      }

      showNotification(
        `❌ Error al aprobar y crear obra:\n\n${mensajeError}\n\n` +
        (mensajeError.includes('ya fue aprobado') ? '' : 'Verifique:\n• Dirección de obra completa (calle y altura obligatorios)\n• Datos del presupuesto\n• Conexión al backend'),
        'danger'
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDuplicate = () => {
    if (!selectedId) return showNotification('Seleccione un presupuesto para duplicar', 'warning');
    setConfirmState({ show: true, action: 'duplicate', payload: { id: selectedId } });
  };

  const execDuplicate = async (id) => {
    setConfirmState({ show: false, action: null, payload: null });
    setLoadingAction('duplicate');
    try {
      await apiService.presupuestosNoCliente.duplicar(id); // empresaId se inyecta automáticamente
      showNotification('Presupuesto duplicado', 'success');
      onRefresh && onRefresh();
    } catch (err) {
      showNotification(err.message || 'Error al duplicar', 'danger');
    } finally { setLoadingAction(null); }
  };

  const handleSave = async (payload) => {
    setLoadingAction('save');
    try {
      if (editingData && editingData.id) {
        // 🔥 CAMBIO CRÍTICO: Actualizar versión existente sin crear nueva
        console.log(`📝 Actualizando presupuesto ID ${editingData.id} sin crear nueva versión`);

        // 🔥 SOLUCIÓN CRÍTICA: Obtener presupuesto completo del backend primero
        console.log('📥 Obteniendo presupuesto completo del backend...');
        const presupuestoCompleto = await apiService.presupuestosNoCliente.getById(
          editingData.id,
          empresaId
        );
        console.log('✅ Presupuesto completo obtenido');

        // Hacer merge: todos los campos + cambios del usuario
        const presupuestoFinal = {
          ...presupuestoCompleto,  // ← Todos los campos del backend
          ...payload,              // ← Cambios del usuario
          id: editingData.id       // ← Asegurar ID
        };

        console.log('📤 Enviando PUT con presupuesto completo');

        // PUT para actualizar el presupuesto existente
        const response = await apiService.presupuestosNoCliente.update(
          editingData.id,
          presupuestoFinal,
          empresaId
        );

        showNotification(`Presupuesto actualizado correctamente (Versión ${response?.numeroVersion || presupuestoFinal.version})`, 'success');
        setDireccionBusqueda(null); // Limpiar datos de búsqueda
      } else {
        // Modo creación: usar POST (empresaId se inyecta automáticamente)
        await apiService.presupuestosNoCliente.create(payload, empresaId);
        showNotification('Presupuesto creado', 'success');
      }
      setShowModal(false);
      setEditingData(null);
      onRefresh && onRefresh();
    } catch (err) {
      showNotification(err.message || 'Error al guardar', 'danger');
    } finally { setLoadingAction(null); }
  };

  const verificarCamposDescripcionObservaciones = async () => {
    setLoadingAction('verify');
    try {
      // Verificar si existe el endpoint de health check
      if (apiService.healthCheck && apiService.healthCheck.verificarCamposDescripcionObservaciones) {
        const response = await apiService.healthCheck.verificarCamposDescripcionObservaciones();

        if (response.estadoGeneral === 'LISTO') {
          showNotification('✅ Backend y BD listos para campos descripción/observaciones', 'success');
        } else {
          const errores = Object.keys(response.verificaciones)
            .filter(key => key.endsWith('_ERROR'))
            .map(key => response.verificaciones[key])
            .flat();

          showNotification(`⚠️ Backend/BD con problemas:\n${errores.join('\n')}`, 'warning');
        }
      } else {
        // Fallback: verificar creando un presupuesto de prueba con los campos
        const testData = {
          nombreEmpresa: 'TEST_VERIFICACION',
          descripcionCalc: 'Test descripción general',
          observacionesCalc: 'Test observaciones generales',
          descripcionProfesionales: 'Test descripción profesionales',
          observacionesProfesionales: 'Test observaciones profesionales',
          descripcionMateriales: 'Test descripción materiales',
          observacionesMateriales: 'Test observaciones materiales',
          direccionObraCalle: 'CALLE_TEST_DELETE',
          direccionObraAltura: '99999'
        };

        showNotification('🔍 Verificando compatibilidad con test funcional...', 'info');

        const testResponse = await apiService.presupuestosNoCliente.create(testData);

        if (testResponse && testResponse.id) {
          // Recuperar el presupuesto para verificar persistencia
          const recovered = await apiService.presupuestosNoCliente.getById(testResponse.id, empresaId);

          const camposOK =
            recovered.descripcionCalc === testData.descripcionCalc &&
            recovered.observacionesCalc === testData.observacionesCalc &&
            recovered.descripcionProfesionales === testData.descripcionProfesionales &&
            recovered.observacionesProfesionales === testData.observacionesProfesionales;

          // Eliminar presupuesto de prueba
          await apiService.presupuestosNoCliente.delete(testResponse.id);

          if (camposOK) {
            showNotification(
              '✅ VERIFICACIÓN EXITOSA\n\n' +
              '🔹 BD acepta campos descripción/observaciones\n' +
              '🔹 Backend persiste correctamente\n' +
              '🔹 Frontend compatible\n\n' +
              '🎯 Sistema listo para usar campos descripción/observaciones',
              'success'
            );
          } else {
            showNotification(
              '⚠️ VERIFICACIÓN CON PROBLEMAS\n\n' +
              'Los campos se envían pero no se recuperan correctamente.\n' +
              'Verificar mapeo en DTOs del backend.',
              'warning'
            );
          }
        }
      }
    } catch (err) {
      console.error('Error en verificación:', err);
      showNotification(
        `❌ Error en verificación de campos:\n\n${err.message}\n\n` +
        'Posibles causas:\n' +
        '• Backend no actualizado\n' +
        '• Campos no implementados en BD\n' +
        '• Error en mapeo de DTOs',
        'danger'
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="d-flex gap-2 align-items-center">
      <button className="btn btn-primary" onClick={handleNew} disabled={!!loadingAction}><i className="fas fa-plus me-1"></i>Nuevo</button>
      <button className="btn btn-outline-primary" onClick={handleEdit} disabled={!!loadingAction}>
        {loadingAction === 'buscar' ? (
          <><i className="fas fa-spinner fa-spin me-1"></i> Buscando</>
        ) : (
          <><i className="fas fa-edit me-1"></i>Editar</>
        )}
      </button>
      <button className="btn btn-outline-info" onClick={handleListarTodos} disabled={!!loadingAction}>
        <i className="fas fa-list me-1"></i>Listar Todos
      </button>
      <button className="btn btn-outline-danger" onClick={handleDelete} disabled={!!loadingAction}>{loadingAction === 'delete' ? (<><i className="fas fa-spinner fa-spin me-1"></i> Eliminando</>) : (<><i className="fas fa-trash me-1"></i>Eliminar</>)}</button>
      <button
        className="btn btn-success"
        onClick={handleApprove}
        disabled={!!loadingAction}
        title={tieneObraAsociada
          ? "Aprobar presupuesto (sin crear nueva obra)"
          : "Aprobar presupuesto y crear obra automáticamente"
        }
      >
        {loadingAction === 'approve' ? (
          <>
            <i className="fas fa-spinner fa-spin me-1"></i>
            {tieneObraAsociada ? 'Aprobando...' : 'Aprobando y creando obra...'}
          </>
        ) : (
          <>
            <i className="fas fa-check-double me-1"></i>
            {tieneObraAsociada ? '✅ Aprobar' : '🏗️ Aprobar → Crear Obra'}
          </>
        )}
      </button>
      <button className="btn btn-outline-warning" onClick={handleDuplicate} disabled={!!loadingAction}>{loadingAction === 'duplicate' ? (<><i className="fas fa-spinner fa-spin me-1"></i> Duplicando</>) : (<><i className="fas fa-clone me-1"></i>Duplicar</>)}</button>

      {/* Botón de verificación de campos descripción/observaciones */}
      <button
        className="btn btn-outline-info"
        onClick={verificarCamposDescripcionObservaciones}
        disabled={!!loadingAction}
        title="Verificar que backend y BD estén listos para campos descripción/observaciones"
      >
        {loadingAction === 'verify' ? (
          <>
            <i className="fas fa-spinner fa-spin me-1"></i>
            Verificando...
          </>
        ) : (
          <>
            <i className="fas fa-check-circle me-1"></i>
            Verificar Campos
          </>
        )}
      </button>

      {/* Modal de búsqueda para editar */}
      <BuscarPresupuestoNoClienteModal
        show={showBuscarModal}
        onClose={() => setShowBuscarModal(false)}
        onBuscar={handleBuscarYEditar}
        loading={loadingAction === 'buscar'}
      />

      {/* Modal de listar todos */}
      <ListarTodosPresupuestosNoClienteModal
        show={showListarTodosModal}
        onClose={() => setShowListarTodosModal(false)}
        empresaId={empresaId}
        apiService={apiService}
      />

      {showModal && (
        <PresupuestoNoClienteModal
          show={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialData={editingData}
          saving={loadingAction === 'save'}
        />
      )}
      {showModal && (
        /* pasar saving flag para deshabilitar inputs dentro del modal */
        null
      )}

      {/* Confirm modal simple inline */}
      {confirmState.show && (
        <div className="modal show d-block" style={{ zIndex: 3000 }}>
          <div className="modal-dialog modal-sm" style={{ marginTop: '140px' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar</h5>
                <button className="btn-close" onClick={() => setConfirmState({ show: false, action: null, payload: null })}></button>
              </div>
              <div className="modal-body">
                <p>¿Confirma la acción <strong>{confirmState.action}</strong>?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmState({ show: false, action: null, payload: null })}>Cancelar</button>
                {confirmState.action === 'delete' && (
                  <button className="btn btn-danger" onClick={() => execDelete(confirmState.payload.id)}>Eliminar</button>
                )}
                {confirmState.action === 'duplicate' && (
                  <button className="btn btn-warning" onClick={() => execDuplicate(confirmState.payload.id)}>Duplicar</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresupuestoNoClienteControls;
