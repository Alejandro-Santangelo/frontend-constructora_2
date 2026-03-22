/**
 * 📋 EJEMPLO DE MARCADO DE SECCIONES
 * 
 * Este archivo muestra cómo agregar las clases CSS necesarias
 * para que el PDF Cliente oculte correctamente las secciones internas.
 * 
 * Busca estas secciones en tu PresupuestoNoClienteModal.jsx
 * y agrega las clases indicadas.
 */

// ========================================
// EJEMPLO 1: Metadata Administrativa
// ========================================
// ANTES:
<Row className="mb-3">
  <Col md={3}>
    <Form.Label>Fecha de Creación</Form.Label>
    <Form.Control type="date" name="fechaCreacion" value={fechaCreacion} />
  </Col>
  <Col md={1}>
    <Form.Label>Versión</Form.Label>
    <Form.Control type="text" name="version" value={version} readOnly />
  </Col>
  <Col md={2}>
    <Form.Label>Estado</Form.Label>
    <Form.Select name="estado" value={estado}>
      <option>Borrador</option>
      <option>Enviado</option>
    </Form.Select>
  </Col>
</Row>

// DESPUÉS (con clases):
<Row className="mb-3">
  <Col md={3} className="ocultar-en-pdf metadata-administrativa">
    <Form.Label>Fecha de Creación</Form.Label>
    <Form.Control type="date" name="fechaCreacion" value={fechaCreacion} />
  </Col>
  <Col md={1} className="ocultar-en-pdf metadata-administrativa">
    <Form.Label>Versión</Form.Label>
    <Form.Control type="text" name="version" value={version} readOnly />
  </Col>
  <Col md={2} className="ocultar-en-pdf metadata-administrativa">
    <Form.Label>Estado</Form.Label>
    <Form.Select name="estado" value={estado}>
      <option>Borrador</option>
      <option>Enviado</option>
    </Form.Select>
  </Col>
</Row>


// ========================================
// EJEMPLO 2: Sección de Configuración de Honorarios
// ========================================
// ANTES:
<div className="border rounded p-3 mb-3">
  <h6 className="mb-3">
    <i className="fas fa-user-tie"></i> Configuración de Honorarios Profesionales
  </h6>
  <Row>
    <Col md={4}>
      <Form.Label>Porcentaje Base (%)</Form.Label>
      <Form.Control type="number" name="honorariosBase" />
    </Col>
    <Col md={4}>
      <Form.Label>Aplicar a</Form.Label>
      <Form.Select name="honorariosAplicacion">
        <option>Total</option>
        <option>Subtotal</option>
      </Form.Select>
    </Col>
  </Row>
</div>

// DESPUÉS (con clases):
<div className="ocultar-en-pdf seccion-interna border rounded p-3 mb-3">
  <h6 className="mb-3">
    <i className="fas fa-user-tie"></i> Configuración de Honorarios Profesionales
  </h6>
  <Row>
    <Col md={4}>
      <Form.Label>Porcentaje Base (%)</Form.Label>
      <Form.Control type="number" name="honorariosBase" />
    </Col>
    <Col md={4}>
      <Form.Label>Aplicar a</Form.Label>
      <Form.Select name="honorariosAplicacion">
        <option>Total</option>
        <option>Subtotal</option>
      </Form.Select>
    </Col>
  </Row>
</div>


// ========================================
// EJEMPLO 3: Sección de Mayores Costos
// ========================================
// ANTES:
<div className="border rounded p-3 mb-3">
  <h6 className="mb-3">
    <i className="fas fa-chart-line"></i> Configuración de Mayores Costos
  </h6>
  <Row>
    <Col md={6}>
      <Form.Check 
        type="checkbox" 
        label="Aplicar mayores costos por inflación" 
        name="aplicarMayoresCostos"
      />
    </Col>
    <Col md={6}>
      <Form.Label>Porcentaje Inflación Anual (%)</Form.Label>
      <Form.Control type="number" name="inflacionAnual" />
    </Col>
  </Row>
</div>

// DESPUÉS (con clases):
<div className="ocultar-en-pdf seccion-interna border rounded p-3 mb-3">
  <h6 className="mb-3">
    <i className="fas fa-chart-line"></i> Configuración de Mayores Costos
  </h6>
  <Row>
    <Col md={6}>
      <Form.Check 
        type="checkbox" 
        label="Aplicar mayores costos por inflación" 
        name="aplicarMayoresCostos"
      />
    </Col>
    <Col md={6}>
      <Form.Label>Porcentaje Inflación Anual (%)</Form.Label>
      <Form.Control type="number" name="inflacionAnual" />
    </Col>
  </Row>
</div>


// ========================================
// EJEMPLO 4: Sección de Descuentos
// ========================================
// ANTES:
<div className="border rounded p-3 mb-3">
  <h6 className="mb-3">
    <i className="fas fa-percentage"></i> Configuración de Descuentos
  </h6>
  <Row>
    <Col md={4}>
      <Form.Label>Descuento por Pronto Pago (%)</Form.Label>
      <Form.Control type="number" name="descuentoProntoPago" />
    </Col>
    <Col md={4}>
      <Form.Label>Descuento por Volumen (%)</Form.Label>
      <Form.Control type="number" name="descuentoVolumen" />
    </Col>
  </Row>
</div>

// DESPUÉS (con clases):
<div className="ocultar-en-pdf seccion-interna border rounded p-3 mb-3">
  <h6 className="mb-3">
    <i className="fas fa-percentage"></i> Configuración de Descuentos
  </h6>
  <Row>
    <Col md={4}>
      <Form.Label>Descuento por Pronto Pago (%)</Form.Label>
      <Form.Control type="number" name="descuentoProntoPago" />
    </Col>
    <Col md={4}>
      <Form.Label>Descuento por Volumen (%)</Form.Label>
      <Form.Control type="number" name="descuentoVolumen" />
    </Col>
  </Row>
</div>


// ========================================
// EJEMPLO 5: Tabla de Listado de Presupuestos
// ========================================
// ANTES:
<div className="mt-4">
  <h6 className="mb-3">Listado de Presupuestos Anteriores</h6>
  <div className="table-responsive">
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {presupuestosAnteriores.map(p => (
          <tr key={p.id}>
            <td>{p.numero}</td>
            <td>{p.fecha}</td>
            <td>{p.cliente}</td>
            <td>${p.total}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
</div>

// DESPUÉS (con clases):
<div className="ocultar-en-pdf tabla-listado-presupuestos mt-4">
  <h6 className="mb-3">Listado de Presupuestos Anteriores</h6>
  <div className="table-responsive">
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {presupuestosAnteriores.map(p => (
          <tr key={p.id}>
            <td>{p.numero}</td>
            <td>{p.fecha}</td>
            <td>{p.cliente}</td>
            <td>${p.total}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
</div>


// ========================================
// EJEMPLO 6: Acciones de Exportación (otros botones)
// ========================================
// ANTES:
<div className="mt-4">
  <h6 className="mb-3">Acciones de Exportación</h6>
  <Row className="g-2">
    <Col md={4}>
      <Button variant="outline-success" className="w-100">
        <i className="fas fa-file-excel"></i> Exportar a Excel
      </Button>
    </Col>
    <Col md={4}>
      <Button variant="outline-primary" className="w-100">
        <i className="fas fa-file-word"></i> Exportar a Word
      </Button>
    </Col>
    <Col md={4}>
      <Button variant="outline-secondary" className="w-100">
        <i className="fas fa-print"></i> Imprimir
      </Button>
    </Col>
  </Row>
</div>

// DESPUÉS (con clases):
<div className="ocultar-en-pdf acciones-exportacion mt-4">
  <h6 className="mb-3">Acciones de Exportación</h6>
  <Row className="g-2">
    <Col md={4}>
      <Button variant="outline-success" className="w-100">
        <i className="fas fa-file-excel"></i> Exportar a Excel
      </Button>
    </Col>
    <Col md={4}>
      <Button variant="outline-primary" className="w-100">
        <i className="fas fa-file-word"></i> Exportar a Word
      </Button>
    </Col>
    <Col md={4}>
      <Button variant="outline-secondary" className="w-100">
        <i className="fas fa-print"></i> Imprimir
      </Button>
    </Col>
  </Row>
</div>


// ========================================
// EJEMPLO 7: Botones de Acciones Internas
// ========================================
// ANTES:
<Button 
  variant="danger" 
  onClick={handleEliminar}
>
  <i className="fas fa-trash"></i> Eliminar Presupuesto
</Button>

// DESPUÉS (con clase):
<Button 
  variant="danger" 
  onClick={handleEliminar}
  className="ocultar-en-pdf"
>
  <i className="fas fa-trash"></i> Eliminar Presupuesto
</Button>


// ========================================
// RESUMEN DE CLASES A USAR
// ========================================

/*
1. CLASE BASE (aplicar a TODOS los elementos que deben ocultarse):
   className="ocultar-en-pdf"

2. CLASES ESPECÍFICAS (combinar con la clase base):
   - metadata-administrativa → Fecha creación, versión, estado
   - seccion-interna → Secciones completas de configuración
   - tabla-listado-presupuestos → Tablas de listados/históricos
   - acciones-exportacion → Botones de export/import/acciones

3. EJEMPLOS DE COMBINACIÓN:
   className="ocultar-en-pdf metadata-administrativa"
   className="ocultar-en-pdf seccion-interna border rounded p-3"
   className="ocultar-en-pdf tabla-listado-presupuestos mt-4"
   className="ocultar-en-pdf acciones-exportacion"

4. NO AGREGAR A:
   - Datos del cliente (nombre, teléfono, dirección)
   - Tabla principal de rubros y materiales
   - Totales finales (subtotal, honorarios finales, total general)
   - Logo de la empresa
   - Encabezados principales
   - Fechas de vigencia del presupuesto
*/

// ========================================
// CHECKLIST DE VERIFICACIÓN
// ========================================

/*
Al "capturar" PDF Cliente, NO DEBE VERSE:
✗ Fecha de creación del presupuesto
✗ Versión del presupuesto
✗ Estado (Borrador/Enviado/etc.)
✗ Configuración de honorarios (% base, aplicación)
✗ Configuración de mayores costos (inflación, %)
✗ Configuración de descuentos (pronto pago, volumen)
✗ Tabla de presupuestos anteriores
✗ Botones de "Exportar a Excel/Word"
✗ Botón de "Eliminar"
✗ Checkboxes de "🔒 Ocultar en PDF"

Al "capturar" PDF Cliente, SÍ DEBE VERSE:
✓ Nombre/Razón social del solicitante
✓ Teléfono del solicitante
✓ Dirección de obra
✓ Logo de la empresa
✓ Número de presupuesto
✓ Fecha de vigencia
✓ Tabla de rubros con materiales y precios
✓ Subtotales por rubro
✓ Total de honorarios (valor final, no la configuración)
✓ Total de mayores costos (valor final, no la configuración)
✓ Total general
✓ Condiciones de pago
✓ Garantías
✓ Botón de WhatsApp (si se genera después del PDF)
*/
