import React, { useState, useEffect } from 'react';
import apiService, { getCurrentTenant } from '../services/api';

const ManagementPanel = ({ entityType, selectedItem }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [relatedData, setRelatedData] = useState({});

  // Configuración de entidades con todas sus operaciones
  const entityConfig = {
    clientes: {
      title: 'Cliente',
      icon: 'fas fa-users',
      color: 'success',
      tabs: [
        { id: 'details', label: 'Detalles', icon: 'fas fa-info-circle' },
        { id: 'obras', label: 'Obras', icon: 'fas fa-hard-hat' },
        { id: 'edit', label: 'Editar', icon: 'fas fa-edit' },
        { id: 'delete', label: 'Eliminar', icon: 'fas fa-trash' }
      ],
      fields: {
        nombre: { label: 'Nombre', type: 'text', required: true },
        cuitCuil: { label: 'CUIT/CUIL', type: 'text', required: true },
        email: { label: 'Email', type: 'email' },
        telefono: { label: 'Teléfono', type: 'text' },
        direccion: { label: 'Dirección', type: 'text' },
        ciudad: { label: 'Ciudad', type: 'text' },
        provincia: { label: 'Provincia', type: 'text' },
        activo: { label: 'Activo', type: 'checkbox' }
      }
    },
    obras: {
      title: 'Obra',
      icon: 'fas fa-hard-hat',
      color: 'warning',
      tabs: [
        { id: 'details', label: 'Detalles', icon: 'fas fa-info-circle' },
        { id: 'costos', label: 'Costos', icon: 'fas fa-dollar-sign' },
        { id: 'jornales', label: 'Jornales', icon: 'fas fa-clock' },
        { id: 'edit', label: 'Editar', icon: 'fas fa-edit' },
        { id: 'delete', label: 'Eliminar', icon: 'fas fa-trash' }
      ],
      fields: {
        nombre: { label: 'Nombre', type: 'text', required: true },
        descripcion: { label: 'Descripción', type: 'textarea' },
        fechaInicio: { label: 'Fecha Inicio', type: 'date' },
        fechaFinEstimada: { label: 'Fecha Fin Estimada', type: 'date' },
        estado: { label: 'Estado', type: 'select', options: ['PLANIFICADA', 'EN_PROGRESO', 'SUSPENDIDA', 'FINALIZADA'] },
        presupuestoTotal: { label: 'Presupuesto Total', type: 'number' },
        clienteId: { label: 'Cliente', type: 'select', source: 'clientes' }
      }
    },
    profesionales: {
      title: 'Profesional',
      icon: 'fas fa-user-tie',
      color: 'primary',
      tabs: [
        { id: 'details', label: 'Detalles', icon: 'fas fa-info-circle' },
        { id: 'honorarios', label: 'Honorarios', icon: 'fas fa-money-bill' },
        { id: 'edit', label: 'Editar', icon: 'fas fa-edit' },
        { id: 'delete', label: 'Eliminar', icon: 'fas fa-trash' }
      ],
      fields: {
        nombre: { label: 'Nombre', type: 'text', required: true },
        tipoProfesional: { label: 'Tipo', type: 'select', options: ['ARQUITECTO', 'INGENIERO', 'MAESTRO_MAYOR', 'OTRO'] },
        especialidad: { label: 'Especialidad', type: 'text' },
        matricula: { label: 'Matrícula', type: 'text' },
        email: { label: 'Email', type: 'email' },
        telefono: { label: 'Teléfono', type: 'text' }
      }
    },
    materiales: {
      title: 'Material',
      icon: 'fas fa-boxes',
      color: 'secondary',
      tabs: [
        { id: 'details', label: 'Detalles', icon: 'fas fa-info-circle' },
        { id: 'stock', label: 'Stock', icon: 'fas fa-warehouse' },
        { id: 'edit', label: 'Editar', icon: 'fas fa-edit' },
        { id: 'delete', label: 'Eliminar', icon: 'fas fa-trash' }
      ],
      fields: {
        nombre: { label: 'Nombre', type: 'text', required: true },
        descripcion: { label: 'Descripción', type: 'textarea' },
        unidadMedida: { label: 'Unidad de Medida', type: 'text' },
        categoria: { label: 'Categoría', type: 'text' },
        precioUnitario: { label: 'Precio Unitario', type: 'number' }
      }
    },
    proveedores: {
      title: 'Proveedor',
      icon: 'fas fa-truck',
      color: 'info',
      tabs: [
        { id: 'details', label: 'Detalles', icon: 'fas fa-info-circle' },
        { id: 'facturas', label: 'Facturas', icon: 'fas fa-file-invoice' },
        { id: 'edit', label: 'Editar', icon: 'fas fa-edit' },
        { id: 'delete', label: 'Eliminar', icon: 'fas fa-trash' }
      ],
      fields: {
        nombre: { label: 'Nombre', type: 'text', required: true },
        cuit: { label: 'CUIT', type: 'text' },
        email: { label: 'Email', type: 'email' },
        telefono: { label: 'Teléfono', type: 'text' },
        direccion: { label: 'Dirección', type: 'text' },
        ciudad: { label: 'Ciudad', type: 'text' },
        activo: { label: 'Activo', type: 'checkbox' }
      }
    },
    empresas: {
      title: 'Empresa',
      icon: 'fas fa-building',
      color: 'primary',
      tabs: [
        { id: 'details', label: 'Detalles', icon: 'fas fa-info-circle' },
        { id: 'edit', label: 'Editar', icon: 'fas fa-edit' },
        { id: 'delete', label: 'Eliminar', icon: 'fas fa-trash' }
      ],
      fields: {
        nombreEmpresa: { label: 'Nombre Empresa', type: 'text', required: true },
        cuit: { label: 'CUIT', type: 'text', required: true },
        razonSocial: { label: 'Razón Social', type: 'text' },
        direccion: { label: 'Dirección', type: 'text' },
        ciudad: { label: 'Ciudad', type: 'text' },
        provincia: { label: 'Provincia', type: 'text' },
        telefono: { label: 'Teléfono', type: 'text' },
        email: { label: 'Email', type: 'email' }
      }
    }
  };

  const config = entityConfig[entityType] || {};

  useEffect(() => {
    if (selectedItem && activeTab === 'details') {
      setFormData(selectedItem);
      loadRelatedData();
    }
  }, [selectedItem, activeTab, entityType]);

  const loadRelatedData = async () => {
    if (!selectedItem) return;

    try {
      setLoading(true);
      const related = {};

      // Cargar datos relacionados según la entidad
      switch (entityType) {
        case 'clientes':
          if (selectedItem.id) {
            related.obras = await apiService.obras.getByCliente(getCurrentTenant(), selectedItem.id);
          }
          break;
        case 'obras':
          if (selectedItem.id) {
            related.costos = await apiService.costos.getByObra(getCurrentTenant(), selectedItem.id);
            related.jornales = await apiService.jornales.getByObra(getCurrentTenant(), selectedItem.id);
          }
          break;
        case 'profesionales':
          if (selectedItem.id) {
            related.honorarios = await apiService.honorarios.getByProfesional(selectedItem.id);
          }
          break;
        case 'materiales':
          if (selectedItem.id) {
            related.stock = await apiService.stock.getByMaterial(selectedItem.id);
          }
          break;
        case 'proveedores':
          if (selectedItem.id) {
            related.facturas = await apiService.facturas.getByProveedor(getCurrentTenant(), selectedItem.id);
          }
          break;
      }

      setRelatedData(related);
    } catch (error) {
      console.error('Error loading related data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const service = apiService[entityType];
      if (!service) return;

      // Actualizar usando el servicio apropiado
      let result;
      if (['clientes', 'obras', 'proveedores'].includes(entityType)) {
        result = await service.update(getCurrentTenant(), selectedItem.id, formData);
      } else {
        result = await service.update(selectedItem.id, formData);
      }

      alert('Guardado exitosamente');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Está seguro de eliminar este ${config.title.toLowerCase()}?`)) {
      return;
    }

    try {
      setLoading(true);
      
      const service = apiService[entityType];
      if (!service) return;

      // Eliminar usando el servicio apropiado
      if (['clientes', 'obras', 'proveedores'].includes(entityType)) {
        await service.delete(getCurrentTenant(), selectedItem.id);
      } else {
        await service.delete(selectedItem.id);
      }

      alert('Eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (fieldKey, fieldConfig) => {
    const value = formData[fieldKey] || '';
    
    switch (fieldConfig.type) {
      case 'textarea':
        return (
          <textarea
            className="form-control"
            value={value}
            onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})}
            rows={3}
          />
        );
      case 'checkbox':
        return (
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={!!value}
              onChange={(e) => setFormData({...formData, [fieldKey]: e.target.checked})}
            />
          </div>
        );
      case 'select':
        return (
          <select
            className="form-select"
            value={value}
            onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})}
          >
            <option value="">Seleccionar...</option>
            {fieldConfig.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type={fieldConfig.type}
            className="form-control"
            value={value}
            onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})}
          />
        );
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return (
          <div className="p-4">
            <div className="row g-3">
              {Object.entries(config.fields || {}).map(([fieldKey, fieldConfig]) => (
                <div key={fieldKey} className="col-md-6">
                  <label className="form-label fw-bold">
                    {fieldConfig.label}
                    {fieldConfig.required && <span className="text-danger">*</span>}
                  </label>
                  <div className="border rounded p-2 bg-light">
                    {formData[fieldKey] || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'edit':
        return (
          <div className="p-4">
            <form>
              <div className="row g-3">
                {Object.entries(config.fields || {}).map(([fieldKey, fieldConfig]) => (
                  <div key={fieldKey} className="col-md-6">
                    <label className="form-label fw-bold">
                      {fieldConfig.label}
                      {fieldConfig.required && <span className="text-danger">*</span>}
                    </label>
                    {renderField(fieldKey, fieldConfig)}
                  </div>
                ))}
              </div>
              <div className="mt-4 d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-${config.color}`}
                  onClick={handleSave}
                  disabled={loading}
                >
                  <i className="fas fa-save me-2"></i>
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFormData(selectedItem)}
                >
                  <i className="fas fa-undo me-2"></i>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        );

      case 'delete':
        return (
          <div className="p-4">
            <div className="alert alert-danger">
              <h5><i className="fas fa-exclamation-triangle me-2"></i>Eliminar {config.title}</h5>
              <p>¿Está seguro de que desea eliminar este {config.title.toLowerCase()}?</p>
              <p><strong>Esta acción no se puede deshacer.</strong></p>
              <div className="mt-3">
                <button
                  className="btn btn-danger me-2"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <i className="fas fa-trash me-2"></i>
                  {loading ? 'Eliminando...' : 'Confirmar Eliminación'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveTab('details')}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4">
            <div className="text-center text-muted">
              <i className="fas fa-cog fs-1 mb-3"></i>
              <p>Funcionalidad en desarrollo</p>
            </div>
          </div>
        );
    }
  };

  if (!selectedItem) {
    return (
      <div className="flex-grow-1 d-flex align-items-center justify-content-center">
        <div className="text-center text-muted">
          <i className="fas fa-mouse-pointer fs-1 mb-3"></i>
          <h4>Selecciona un elemento</h4>
          <p>Elige un elemento del sidebar para gestionarlo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow-1 d-flex flex-column">
      {/* Header */}
      <div className="bg-white border-bottom p-3">
        <div className="d-flex align-items-center">
          <div className={`rounded-circle p-3 me-3 bg-${config.color} bg-opacity-10`}>
            <i className={`${config.icon} text-${config.color} fs-4`}></i>
          </div>
          <div>
            <h4 className="mb-1 fw-bold">
              {selectedItem[config.fields?.nombre?.label === 'Nombre' ? 'nombre' : 'nombreEmpresa'] || 'Sin nombre'}
            </h4>
            <small className="text-muted">
              {config.title} ID: {selectedItem.id}
            </small>
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mt-3">
          {config.tabs?.map(tab => (
            <li key={tab.id} className="nav-item">
              <button
                className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`${tab.icon} me-2`}></i>
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Content */}
      <div className="flex-grow-1 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ManagementPanel;