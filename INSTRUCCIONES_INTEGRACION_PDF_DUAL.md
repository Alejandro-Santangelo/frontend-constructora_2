# 📄 Instrucciones de Integración - Sistema de PDF Dual

## 🎯 Objetivo
Integrar el componente `BotonesExportarPDFPresupuesto` que genera dos tipos de PDF:
- **PDF Interno**: Completo, con todas las configuraciones (para uso de la empresa)
- **PDF Cliente**: Limpio, solo información relevante (para enviar al cliente)

## ✅ Ya Implementado

### 1. CSS Classes (custom.css)
Ya se agregaron ~170 líneas de CSS con clases:
- `.ocultar-en-pdf` - Base para elementos ocultables
- `.capturando-pdf` - Clase de contexto durante captura
- `.capturando-pdf.pdf-cliente` - Oculta secciones internas
- `.capturando-pdf.pdf-interno` - Muestra todo

### 2. Componente (BotonesExportarPDFPresupuesto.jsx)
Componente completísimo listo para usar en:
```
frontend-constructora_2/src/components/BotonesExportarPDFPresupuesto.jsx
```

## 🔧 Pasos de Integración

### Paso 1: Importar el Componente
En el archivo donde quieras mostrar los botones PDF (probablemente `PresupuestoNoClienteModal.jsx` o similar):

```jsx
import BotonesExportarPDFPresupuesto from './BotonesExportarPDFPresupuesto';
```

### Paso 2: Agregar el Componente en el JSX
Reemplazar el botón actual "Guardar PDF" con:

```jsx
<BotonesExportarPDFPresupuesto
  modalContentRef={modalContentRef} // Tu ref que apunta al contenedor del modal
  presupuesto={presupuesto} // Objeto con datos del presupuesto
  abrirWhatsAppDespuesDePDF={true} // true/false según necesites
  onPDFGenerado={(blob, tipo) => {
    console.log(`PDF ${tipo} generado:`, blob);
    // Aquí puedes agregar lógica adicional si necesitas
  }}
/>
```

### Paso 3: Asegurar que el Ref Existe
Verificar que tengas un `useRef` apuntando al contenedor principal del contenido:

```jsx
const modalContentRef = useRef(null);

// Y en tu JSX:
<div ref={modalContentRef} className="modal-content">
  {/* Todo tu contenido aquí */}
</div>
```

## 🎨 Ejemplo Completo de Integración

```jsx
import React, { useRef, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import BotonesExportarPDFPresupuesto from './BotonesExportarPDFPresupuesto';

const PresupuestoNoClienteModal = ({ show, onHide, presupuesto }) => {
  const modalContentRef = useRef(null);
  
  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Presupuesto #{presupuesto?.numeroPresupuesto}</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div ref={modalContentRef}>
          {/* Todo tu contenido actual del presupuesto */}
          
          {/* ... secciones, tablas, inputs, etc ... */}
          
          {/* 🔥 AGREGAR AQUÍ LOS BOTONES PDF DUAL */}
          <BotonesExportarPDFPresupuesto
            modalContentRef={modalContentRef}
            presupuesto={presupuesto}
            abrirWhatsAppDespuesDePDF={true}
          />
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PresupuestoNoClienteModal;
```

## 📌 Clases CSS a Agregar Manualmente

Para que las secciones se oculten correctamente en el **PDF Cliente**, agregar estas clases a los elementos correspondientes:

### 1. Metadata Administrativa
```jsx
<div className="ocultar-en-pdf metadata-administrativa">
  <label>Fecha de Creación</label>
  <input name="fechaCreacion" ... />
</div>

<div className="ocultar-en-pdf metadata-administrativa">
  <label>Versión</label>
  <input name="version" ... />
</div>

<div className="ocultar-en-pdf metadata-administrativa">
  <label>Estado</label>
  <select name="estado" ... />
</div>
```

### 2. Secciones de Configuración
```jsx
<div className="ocultar-en-pdf seccion-interna border rounded">
  <h6>Configuración de Honorarios</h6>
  {/* Inputs de configuración */}
</div>

<div className="ocultar-en-pdf seccion-interna border rounded">
  <h6>Configuración de Mayores Costos</h6>
  {/* Inputs de configuración */}
</div>

<div className="ocultar-en-pdf seccion-interna border rounded">
  <h6>Configuración de Descuentos</h6>
  {/* Inputs de configuración */}
</div>
```

### 3. Tabla de Listado de Presupuestos
```jsx
<div className="ocultar-en-pdf tabla-listado-presupuestos">
  <h6>Listado de Presupuestos</h6>
  <table className="table">
    {/* Tu tabla actual */}
  </table>
</div>
```

### 4. Acciones de Exportación (otros botones)
```jsx
<div className="ocultar-en-pdf acciones-exportacion">
  <h6>Otras Acciones</h6>
  <Button>Exportar a Excel</Button>
  <Button>Exportar a Word</Button>
</div>
```

## 🧪 Cómo Probar

1. **Abrir un presupuesto** en el modal
2. **Click en "PDF Interno"**:
   - Debe generar PDF completo con todas las secciones
   - Debe incluir configuraciones, descuentos, metadata
3. **Click en "PDF Cliente"**:
   - Debe generar PDF limpio sin:
     - Fecha creación, versión, estado
     - Secciones de configuración
     - Tabla de listado de presupuestos
     - Botones de exportación
4. **Verificar WhatsApp**:
   - Si `abrirWhatsAppDespuesDePDF={true}`, debe abrir WhatsApp después
   - Funciona para AMBOS tipos de PDF

## 🔍 Debugging

Si algo no funciona:

### Ver en consola del navegador (F12):
```
📄 Generando PDF para CLIENTE (limpio)
o
📄 Generando PDF INTERNO (completo)
```

### Verificar que el CSS está cargado:
En Developer Tools → Elements → Styles, buscar:
- `.capturando-pdf.pdf-cliente .ocultar-en-pdf { display: none !important; }`

### Verificar las clases en tiempo real:
Mientras genera el PDF, el elemento debe tener:
- Para Cliente: `class="capturando-pdf pdf-cliente"`
- Para Interno: `class="capturando-pdf pdf-interno"`

## 💡 Personalización

### Cambiar estilos de los botones:
Editar en `BotonesExportarPDFPresupuesto.jsx` líneas 150-250 (style props)

### Deshabilitar WhatsApp:
```jsx
<BotonesExportarPDFPresupuesto
  abrirWhatsAppDespuesDePDF={false}
  ...
/>
```

### Agregar lógica después de generar:
```jsx
<BotonesExportarPDFPresupuesto
  onPDFGenerado={(blob, tipo) => {
    if (tipo === 'cliente') {
      // Enviar email automático
      enviarEmailConPDF(blob);
    } else {
      // Guardar en servidor
      guardarPDFEnServidor(blob);
    }
  }}
  ...
/>
```

## ✅ Checklist Final

- [ ] Componente `BotonesExportarPDFPresupuesto.jsx` existe en `src/components/`
- [ ] CSS con clases `.capturando-pdf` está en `custom.css`
- [ ] Componente importado en el modal correspondiente
- [ ] `modalContentRef` apunta al contenedor correcto
- [ ] Clases `.ocultar-en-pdf` agregadas a elementos sensibles
- [ ] Probado PDF Interno (muestra todo)
- [ ] Probado PDF Cliente (oculta secciones internas)
- [ ] WhatsApp funciona en ambos tipos
- [ ] No hay espacios en blanco en PDF Cliente

## 🆘 Soporte

Si necesitas ayuda:
1. Revisar consola del navegador (F12)
2. Verificar que `exportarAPDFReal` y `compartirPorWhatsApp` están disponibles en `exportUtils.js`
3. Confirmar que custom.css se está cargando correctamente

---

**Nota**: Este componente es completamente independiente y reutilizable. Podés usarlo en cualquier otro modal o página que necesite generación de PDF dual.
