import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import api from '../services/api';

const AgregarProfesionalModal = ({ show, onHide, empresaId, onProfesionalCreado }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    rubro: '',
    tipoProfesional: '',
    costoJornal: '',
    telefono: '',
    email: ''
  });

  const [guardando, setGuardando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('🏢 EmpresaId recibido en modal:', empresaId);

    if (!formData.rubro || !formData.tipoProfesional || !formData.costoJornal) {
      alert('Por favor complete los campos obligatorios: Rubro, Tipo de Profesional y Costo Jornal');
      return;
    }

    if (!empresaId) {
      alert('Error: No se identificó la empresa');
      return;
    }

    try {
      setGuardando(true);

      const payload = {
        tipoProfesional: formData.tipoProfesional,
        valorHoraDefault: parseFloat(formData.costoJornal),
        honorarioDia: parseFloat(formData.costoJornal),
        telefono: formData.telefono || '',
        email: formData.email || '',
        empresaId: empresaId,
        activo: true
      };

      // Si no hay nombre, usar el tipo de profesional como nombre
      if (formData.nombre && formData.nombre.trim()) {
        payload.nombre = formData.nombre.trim();
      } else {
        payload.nombre = formData.tipoProfesional;
      }

      // Enviar rubro si fue proporcionado
      if (formData.rubro && formData.rubro.trim()) {
        payload.rubro = formData.rubro.trim();
      }

      console.log('🔍 Creando profesional con payload:', JSON.stringify(payload, null, 2));

      const response = await api.post('/api/profesionales', payload);
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const profesionalCreado = await response.json();

        // Resetear formulario
        setFormData({
          nombre: '',
          rubro: '',
          tipoProfesional: '',
          costoJornal: '',
          telefono: '',
          email: ''
        });

        // Notificar al padre
        if (onProfesionalCreado) {
          onProfesionalCreado(profesionalCreado);
        }

        alert('✅ Profesional creado exitosamente');
        onHide();
      } else {
        const error = await response.text();
        console.error('❌ Error del servidor:', error);
        alert('❌ Error al guardar: ' + error);
      }
    } catch (error) {
      console.error('❌ Error completo:', error);
      alert('❌ Error al crear profesional: ' + error.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleClose = () => {
    // Resetear formulario al cerrar
    setFormData({
      nombre: '',
      rubro: '',
      tipoProfesional: '',
      costoJornal: '',
      telefono: '',
      email: ''
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="md" backdrop="static" keyboard={false}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-user-plus me-2"></i>
          Agregar Nuevo Profesional
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Nombre Completo</Form.Label>
            <Form.Control
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez (opcional)"
              autoFocus
            />
            <Form.Text className="text-muted">
              Si no ingresa un nombre, se generará automáticamente
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Rubro <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              name="rubro"
              value={formData.rubro}
              onChange={handleChange}
              placeholder="Ej: Albañilería, Electricidad, Plomería"
              required
            />
            <Form.Text className="text-muted">
              Categoría general del profesional
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tipo de Profesional <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              name="tipoProfesional"
              value={formData.tipoProfesional}
              onChange={handleChange}
              placeholder="Ej: Oficial Albañil, Electricista, Plomero"
              required
            />
            <Form.Text className="text-muted">
              Especifique el oficio o especialidad
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Costo por Jornal ($) <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="number"
              name="costoJornal"
              value={formData.costoJornal}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="Ej: +54 9 11 1234-5678"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
            />
          </Form.Group>

          <div className="alert alert-info mb-0">
            <small>
              <i className="fas fa-info-circle me-2"></i>
              Los campos marcados con <span className="text-danger">*</span> son obligatorios
            </small>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={guardando}>
            {guardando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Guardando...
              </>
            ) : (
              <>
                <i className="fas fa-save me-2"></i>
                Guardar Profesional
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AgregarProfesionalModal;
