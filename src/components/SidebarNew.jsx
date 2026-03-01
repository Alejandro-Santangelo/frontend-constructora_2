import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useEmpresa } from '../EmpresaContext';

const Sidebar = ({ collapsed, onToggleSidebar, presupuestoControls, obrasControls, materialesControls, gastosControls }) => {
  const location = useLocation();
  const { empresaSeleccionada } = useEmpresa();

  // Verificar si estamos en la página de presupuestos sin cliente
  const isPresupuestosNoClientePage = location.pathname === '/presupuestos-no-cliente';

  // Verificar si estamos en la página de obras
  const isObrasPage = location.pathname === '/obras';

  // Verificar si estamos en la página de materiales
  const isMaterialesPage = location.pathname === '/materiales';

  // Verificar si estamos en la página de gastos generales
  const isGastosPage = location.pathname === '/gastos-generales';

  const menuItems = [
    {
      path: '/proveedores',
      icon: 'fas fa-truck',
      label: 'Proveedores',
      description: 'Gestión de proveedores'
    },
    {
      path: '/stock',
      icon: 'fas fa-warehouse',
      label: 'Stock',
      description: 'Inventario de materiales'
    },
    {
      path: '/presupuestos',
      icon: 'fas fa-file-alt',
      label: 'Presupuestos',
      description: 'Cotizaciones y presupuestos'
    },
    {
      path: '/usuarios',
      icon: 'fas fa-user-cog',
      label: 'Usuarios',
      description: 'Gestión de usuarios'
    },
    {
      path: '/profesionales-obra',
      icon: 'fas fa-users-cog',
      label: 'Profesionales x Obra',
      description: 'Asignaciones por obra'
    }
  ];

  return (
  <nav className={`col-md-${collapsed ? '1' : '3'} col-lg-2 d-md-block sidebar-primary sidebar collapse${collapsed ? ' collapsed' : ''}`}>
      <div className="position-sticky pt-0">
        {/* Botón cerrar/abrir sidebar */}
        <div className="d-flex justify-content-end align-items-center px-2 py-1">
          <button
            className="btn btn-sm btn-light"
            style={{ borderRadius: '50%', width: 32, height: 32 }}
            title={collapsed ? 'Abrir menú' : 'Cerrar menú'}
            onClick={onToggleSidebar}
          >
            <i className={`fas fa-${collapsed ? 'chevron-right' : 'chevron-left'}`}></i>
          </button>
        </div>

        {/* Botones de control para Presupuestos No Cliente */}
        {isPresupuestosNoClientePage && !collapsed && presupuestoControls && (
          <div className="px-3 mt-0 pt-0">
            <div className="d-flex flex-column gap-2">
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#28a745', border: 'none' }}
                onClick={presupuestoControls.handleNuevo}
              >
                <i className="fas fa-plus me-2"></i>Nuevo
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#0056b3', border: 'none', color: '#fff', fontWeight: 'bold' }}
                onClick={presupuestoControls.handleListarTodos}
              >
                <i className="fas fa-list me-2"></i>Listar Todos
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#0dcaf0', border: 'none', color: '#000', fontWeight: 'bold' }}
                onClick={presupuestoControls.handleBuscarPorDireccion}
              >
                <i className="fas fa-filter me-2"></i>Búsqueda Específica
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#E91E63', border: 'none', fontWeight: 'bold' }}
                onClick={presupuestoControls.handleHistorialVersiones}
                title="Ver todas las versiones de presupuestos por dirección"
              >
                <i className="fas fa-history me-2"></i>Historial de Versiones
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#28a745', border: 'none', fontWeight: 'bold' }}
                onClick={presupuestoControls.handleEnviarPresupuesto}
                title="Seleccionar y enviar presupuesto existente"
              >
                <i className="fas fa-paper-plane me-2"></i>Enviar Presupuesto
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#6c757d', border: 'none', fontWeight: 'bold' }}
                onClick={presupuestoControls.handleVerPresupuestoSeleccionado}
                title="Ver presupuesto seleccionado en modo lectura"
              >
                <i className="fas fa-eye me-2"></i>Ver Presupuesto Seleccionado
              </button>

              {/* Botón para editar solo fechas (disponible para cualquier estado) */}
              {presupuestoControls.selectedPresupuesto && (
                <button
                  className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                  style={{ backgroundColor: '#FF6F00', border: 'none', fontWeight: 'bold' }}
                  onClick={presupuestoControls.handleEditarSoloFechas}
                  title="Editar solo Fecha Probable de Inicio y Días Hábiles (sin cambiar versión ni estado)"
                >
                  <i className="fas fa-calendar-edit me-2"></i>Modificar Fechas
                </button>
              )}

              {/* Botón para marcar BORRADOR como listo para enviar (TRADICIONAL o Trabajo Extra) */}
              {presupuestoControls.selectedPresupuesto?.estado === 'BORRADOR' && (
                presupuestoControls.selectedPresupuesto?.tipoPresupuesto === 'TRADICIONAL' ||
                presupuestoControls.selectedPresupuesto?.esPresupuestoTrabajoExtra
              ) && (
                <button
                  className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                  style={{ backgroundColor: '#17a2b8', border: 'none' }}
                  onClick={presupuestoControls.handleMarcarListoParaEnviar}
                  title="Marcar este presupuesto como listo para enviar al cliente (cambia a estado A_ENVIAR)"
                >
                  <i className="fas fa-check-circle me-2"></i>Marcar como Listo
                </button>
              )}

              {/* Separador visual */}
              <hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#FFD700', border: 'none', color: '#000' }}
                disabled={!presupuestoControls.selectedId}
                onClick={presupuestoControls.handleEditar}
              >
                <i className="fas fa-edit me-2"></i>Editar
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#E91E63', border: 'none' }}
                disabled={!presupuestoControls.selectedId}
                onClick={presupuestoControls.handleEliminar}
              >
                <i className="fas fa-trash me-2"></i>Eliminar
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#00BCD4', border: 'none' }}
                disabled={!presupuestoControls.selectedId}
                onClick={presupuestoControls.handleAprobarYCrearObra}
                title={presupuestoControls.selectedPresupuesto?.obraId
                  ? "Aprobar presupuesto (sin crear nueva obra)"
                  : "Aprobar presupuesto y crear obra automáticamente"
                }
              >
                <i className="fas fa-check-double me-2"></i>
                {presupuestoControls.selectedPresupuesto?.obraId
                  ? '✅ Aprobar'
                  : '🏗️ Aprobar → Crear Obra'
                }
              </button>
            </div>
          </div>
        )}

        {/* Sección de acciones para OBRAS INDEPENDIENTES */}
        {isObrasPage && obrasControls && obrasControls.esObrasIndependientes && (
          <div className="mt-3 px-2">
            <div className="mb-2">
              <small className="text-white-50 fw-bold">{obrasControls.titulo || 'OBRAS INDEPENDIENTES'}</small>
              {obrasControls.conteoObras !== undefined && (
                <small className="text-white-50 d-block">{obrasControls.conteoObras} obras</small>
              )}
            </div>
            <div className="d-flex flex-column gap-2">
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#4CAF50', border: 'none' }}
                onClick={obrasControls.handleNuevo}
              >
                <i className="fas fa-plus me-2"></i>nuevo Trabajo Diario
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#9C27B0', border: 'none' }}
                onClick={obrasControls.handleVolver}
              >
                <i className="fas fa-arrow-left me-2"></i>Volver a Obras
              </button>
            </div>
          </div>
        )}

        {/* Sección de acciones para OBRAS */}
        {isObrasPage && obrasControls && !obrasControls.esTrabajosExtra && (
          <div className="mt-3 px-2">
            <div className="mb-2">
              <small className="text-white-50 fw-bold">ACCIONES DE OBRAS</small>
            </div>
            <div className="d-flex flex-column gap-2">
              {/*
                TEMPORALMENTE COMENTADO - En período de prueba
                Esta funcionalidad ahora está disponible desde el Dashboard principal
                como tarjeta "Trabajos - Obras Independientes"
                Si después de probar el nuevo flujo funciona bien, eliminar este código.
                Si hay problemas o usuarios prefieren este botón, descomentarlo.

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#4CAF50', border: 'none' }}
                onClick={obrasControls.handleNuevo}
              >
                <i className="fas fa-plus me-2"></i>Nueva Obra sin Presupuesto Detallado
              </button>
              */}

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#9C27B0', border: 'none', color: '#fff' }}
                onClick={obrasControls.handleBuscarPorCliente}
              >
                <i className="fas fa-user-tie me-2"></i>Buscar por Cliente
              </button>

              {/* Botón de Ver Estadísticas con dropdown */}
              <div className="dropdown w-100">
                <button
                  className="btn w-100 text-start py-3 fs-5 fw-semibold dropdown-toggle"
                  style={{ backgroundColor: '#FF9800', border: 'none', color: '#000' }}
                  type="button"
                  id="dropdownEstadisticas"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i className="fas fa-chart-bar me-2"></i>Ver Estadísticas
                </button>
                <ul className="dropdown-menu w-100" aria-labelledby="dropdownEstadisticas" style={{ backgroundColor: '#fff' }}>
                  <li>
                    <button
                      className="dropdown-item py-2"
                      onClick={obrasControls.handleVerEstadisticasObraSeleccionada}
                      disabled={!obrasControls.selectedId}
                    >
                      <i className="fas fa-building me-2 text-primary"></i>
                      Obra Seleccionada
                      {!obrasControls.selectedId && <small className="text-muted d-block">Seleccione una obra primero</small>}
                    </button>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button
                      className="dropdown-item py-2"
                      onClick={obrasControls.handleVerEstadisticasTodasObras}
                    >
                      <i className="fas fa-chart-line me-2 text-success"></i>
                      Todas las Obras
                    </button>
                  </li>
                </ul>
              </div>

              {/* Separador visual */}
              <hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#FFD700', border: 'none', color: '#000' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleEditar}
                title="Editar presupuesto de obra seleccionada"
              >
                <i className="fas fa-edit me-2"></i>Editar Presupuesto de Obra Seleccionada
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#E91E63', border: 'none' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleEliminar}
              >
                <i className="fas fa-trash me-2"></i>Eliminar
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#00BCD4', border: 'none', color: '#000' }}
                onClick={obrasControls.handleVerProfesionales}
                title={obrasControls.selectedId
                  ? "Ver asignaciones de la obra seleccionada"
                  : "Ver asignaciones de todas las obras"}
              >
                <i className="fas fa-eye me-2"></i>Ver Asignaciones
                {obrasControls.selectedId && (
                  <span className="ms-2 badge bg-dark" style={{ fontSize: '0.7rem' }}>
                    Obra seleccionada
                  </span>
                )}
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#607D8B', border: 'none', color: '#fff' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleCambiarEstado}
                title="Cambiar estado de la obra"
              >
                <i className="fas fa-exchange-alt me-2"></i>Cambiar Estado
              </button>

              {/* Separador visual */}
              <hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />

              {/* Botón Enviar */}
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#28a745', border: 'none' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleEnviarObra}
                title="Enviar presupuesto de la obra seleccionada"
              >
                <i className="fas fa-paper-plane me-2"></i>Enviar Presupuesto de la Obra Seleccionada
              </button>

              {/* Separador visual */}
              <hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />

              {/* Botón Ver Obras Manuales - Siempre visible */}
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#FF6F00', border: 'none' }}
                onClick={obrasControls.handleVerObrasManuales}
                title="Ver todas las obras independientes (sin presupuesto previo)"
              >
                <i className="fas fa-folder-open me-2"></i>Trabajos Diarios / Nuevos Clientes
                <span className="ms-2 badge bg-light text-dark" style={{ fontSize: '0.7rem' }}>
                  {obrasControls.conteoObrasManuales || 0}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Sección de acciones para ADICIONALES OBRA */}
        {isObrasPage && obrasControls && obrasControls.esTrabajosExtra && (
          <div className="mt-3 px-2">
            <div className="mb-2">
              <small className="text-white-50 fw-bold">ADICIONALES OBRA - {obrasControls.nombreObra}</small>
            </div>
            <div className="d-flex flex-column gap-2">
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#4CAF50', border: 'none' }}
                onClick={obrasControls.handleNuevo}
              >
                <i className="fas fa-plus me-2"></i>Nuevo Adicional Obra
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#9C27B0', border: 'none' }}
                onClick={obrasControls.handleVolver}
              >
                <i className="fas fa-arrow-left me-2"></i>Volver a Obras
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#28a745', border: 'none', fontWeight: 'bold' }}
                onClick={obrasControls.handleEnviarTrabajoExtra}
                title="Seleccionar y enviar adicional obra existente"
              >
                <i className="fas fa-paper-plane me-2"></i>Enviar Adicional Obra
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#6c757d', border: 'none', fontWeight: 'bold' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleVerPresupuestoSeleccionado}
                title="Ver adicional seleccionado en modo lectura"
              >
                <i className="fas fa-eye me-2"></i>Ver Adicional Seleccionado
              </button>

              {/* Botón para editar solo fechas (disponible para cualquier estado) */}
              {obrasControls.selectedPresupuesto && (
                <button
                  className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                  style={{ backgroundColor: '#FF6F00', border: 'none', fontWeight: 'bold' }}
                  onClick={obrasControls.handleEditarSoloFechas}
                  title="Editar solo Fecha Probable de Inicio y Días Hábiles (sin cambiar versión ni estado)"
                >
                  <i className="fas fa-calendar-edit me-2"></i>Modificar Fechas
                </button>
              )}

              {/* Botón para marcar BORRADOR como listo para enviar */}
              {obrasControls.selectedPresupuesto?.estado === 'BORRADOR' && (
                <button
                  className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                  style={{ backgroundColor: '#17a2b8', border: 'none' }}
                  onClick={obrasControls.handleMarcarListoParaEnviar}
                  title="Marcar este trabajo extra como listo para enviar"
                >
                  <i className="fas fa-check-circle me-2"></i>Marcar como Listo
                </button>
              )}

              {/* Separador visual */}
              <hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold"
                style={{ backgroundColor: '#FFD700', border: 'none', color: '#000' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleEditar}
              >
                <i className="fas fa-edit me-2"></i>Editar Presupuesto de Obra Seleccionada
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#E91E63', border: 'none' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleEliminar}
              >
                <i className="fas fa-trash me-2"></i>Eliminar
              </button>

              {/* Botón aprobar adicional obra */}
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#00BCD4', border: 'none' }}
                disabled={!obrasControls.selectedId}
                onClick={obrasControls.handleAprobar}
                title="Aprobar adicional obra"
              >
                <i className="fas fa-check-double me-2"></i>✅ Aprobar Adicional Obra
              </button>
            </div>
          </div>
        )}

        {/* Sección de acciones para MATERIALES */}
        {isMaterialesPage && materialesControls && !collapsed && (
          <div className="mt-3 px-2">
            <div className="mb-2">
              <small className="text-white-50 fw-bold">GESTIÓN DE MATERIALES</small>
            </div>
            <div className="d-flex flex-column gap-2">
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#4CAF50', border: 'none' }}
                onClick={materialesControls.handleNuevo}
              >
                <i className="fas fa-plus me-2"></i>Nuevo Material
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#00BCD4', border: 'none' }}
                onClick={materialesControls.handleAjustarTodos}
              >
                <i className="fas fa-percentage me-2"></i>Ajustar Todos
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#FF9800', border: 'none' }}
                disabled={materialesControls.seleccionadosCount === 0}
                onClick={materialesControls.handleAjustarSeleccionados}
              >
                <i className="fas fa-check-square me-2"></i>
                Ajustar Seleccionados ({materialesControls.seleccionadosCount})
              </button>
            </div>
          </div>
        )}

        {/* Sección de acciones para GASTOS GENERALES */}
        {isGastosPage && gastosControls && !collapsed && (
          <div className="mt-3 px-2">
            <div className="mb-2">
              <small className="text-white-50 fw-bold">GESTIÓN DE GASTOS</small>
            </div>
            <div className="d-flex flex-column gap-2">
              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#4CAF50', border: 'none' }}
                onClick={gastosControls.handleNuevo}
              >
                <i className="fas fa-plus me-2"></i>Nuevo Gasto
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#00BCD4', border: 'none' }}
                onClick={gastosControls.handleAjustarTodos}
              >
                <i className="fas fa-percentage me-2"></i>Ajustar Todos
              </button>

              <button
                className="btn w-100 text-start py-3 fs-5 fw-semibold text-white"
                style={{ backgroundColor: '#FF9800', border: 'none' }}
                disabled={gastosControls.seleccionadosCount === 0}
                onClick={gastosControls.handleAjustarSeleccionados}
              >
                <i className="fas fa-check-square me-2"></i>
                Ajustar Seleccionados ({gastosControls.seleccionadosCount})
              </button>
            </div>
          </div>
        )}

        {/* Footer del sidebar eliminado por solicitud */}
      </div>
    </nav>
  );
};

export default Sidebar;
