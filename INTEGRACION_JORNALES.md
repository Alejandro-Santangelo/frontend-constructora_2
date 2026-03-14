# Integración de Jornales Diarios en Frontend

## ✅ Archivos Creados

1. **`src/services/jornalesDiariosService.js`** - Servicio API
2. **`src/components/RegistrarJornalesDiariosModal.jsx`** - Modal para registrar horas
3. **`src/components/HistorialJornalesModal.jsx`** - Modal para ver historial
4. **Imports agregados en `ObrasPage.jsx`**

## 📋 Pasos para Integración Final

### 1. Agregar Estados en ObrasPage.jsx

Buscar la sección donde están los estados de modales (alrededor de línea 200-300) y agregar:

```javascript
// Estados para Jornales Diarios (NUEVA FUNCIONALIDAD)
const [mostrarModalRegistrarJornales, setMostrarModalRegistrarJornales] = React.useState(false);
const [mostrarModalHistorialJornales, setMostrarModalHistorialJornales] = React.useState(false);
const [obraParaJornales, setObraParaJornales] = React.useState(null);
```

### 2. Agregar Handlers

En la sección de handlers (donde están `handleEditar`, `handleEliminar`, etc.), agregar:

```javascript
handleRegistrarJornales: () => {
  if (selectedObraId) {
    // Verificar si es una tarea
    if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
      const tareaIdNumerico = parseInt(selectedObraId.replace('ta_', ''));
      const tarea = trabajosAdicionales.find(ta => ta.id === tareaIdNumerico);
      if (tarea) {
        const tareaComoObra = {
          ...tarea,
          id: tareaIdNumerico,
          nombre: tarea.nombre
        };
        setObraParaJornales(tareaComoObra);
        setMostrarModalRegistrarJornales(true);
      }
    } else {
      // Es una obra normal
      const obra = obras.find(o => o.id === selectedObraId);
      if (obra) {
        setObraParaJornales(obra);
        setMostrarModalRegistrarJornales(true);
      }
    }
  } else {
    showNotification('Seleccione una obra para registrar jornales', 'warning');
  }
},
handleHistorialJornales: () => {
  if (selectedObraId) {
    // Verificar si es una tarea
    if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
      const tareaIdNumerico = parseInt(selectedObraId.replace('ta_', ''));
      const tarea = trabajosAdicionales.find(ta => ta.id === tareaIdNumerico);
      if (tarea) {
        const tareaComoObra = {
          ...tarea,
          id: tareaIdNumerico,
          nombre: tarea.nombre
        };
        setObraParaJornales(tareaComoObra);
        setMostrarModalHistorialJornales(true);
      }
    } else {
      // Es una obra normal
      const obra = obras.find(o => o.id === selectedObraId);
      if (obra) {
        setObraParaJornales(obra);
        setMostrarModalHistorialJornales(true);
      }
    }
  } else {
    showNotification('Seleccione una obra para ver historial', 'warning');
  }
}
```

### 3. Agregar Botones en el Sidebar/Menú

**Opción A: En Configuración de Obra (Recomendado)**

Buscar donde se renderizan los botones de configuración de obra y agregar:

```jsx
<Button 
  variant="info" 
  size="sm"
  onClick={controls.handleRegistrarJornales}
  className="mb-2 w-100"
  disabled={!selectedObraId}
>
  <i className="fas fa-clock me-2"></i>
  📋 Registrar Horas Hoy
</Button>

<Button 
  variant="outline-info" 
  size="sm"
  onClick={controls.handleHistorialJornales}
  className="mb-2 w-100"
  disabled={!selectedObraId}
>
  <i className="fas fa-history me-2"></i>
  📊 Ver Historial de Jornales
</Button>
```

**Opción B: Como Tab separado**

Si prefieres agregar un tab nuevo en el sistema de tabs, buscar donde están los otros tabs y agregar:

```jsx
<Button 
  variant={activeTab === 'jornales' ? 'primary' : 'outline-secondary'}
  onClick={() => {
    dispatch(setActiveTab('jornales'));
    if (selectedObraId) {
      const obra = obras.find(o => o.id === selectedObraId);
      if (obra) {
        setObraParaJornales(obra);
        setMostrarModalRegistrarJornales(true);
      }
    }
  }}
>
  <i className="fas fa-clock me-2"></i>
  Control Horario
</Button>
```

### 4. Agregar Modales al JSX

Al final del archivo, antes del `</div>` de cierre, agregar:

```jsx
{/* 🆕 Modal Registrar Jornales Diarios */}
{mostrarModalRegistrarJornales && obraParaJornales && (
  <RegistrarJornalesDiariosModal
    show={mostrarModalRegistrarJornales}
    onHide={() => {
      setMostrarModalRegistrarJornales(false);
      setObraParaJornales(null);
    }}
    obra={obraParaJornales}
    onJornalCreado={() => {
      showNotification('✅ Jornales registrados exitosamente', 'success');
      // Opcional: recargar datos si es necesario
    }}
  />
)}

{/* 🆕 Modal Historial Jornales */}
{mostrarModalHistorialJornales && obraParaJornales && (
  <HistorialJornalesModal
    show={mostrarModalHistorialJornales}
    onHide={() => {
      setMostrarModalHistorialJornales(false);
      setObraParaJornales(null);
    }}
    obra={obraParaJornales}
  />
)}
```

## 🎯 Ubicación Exacta

Los botones deben agregarse en la sección de **"Configuración y Planificación de Obra"**, junto con los botones existentes de:
- ✅ Asignar Profesionales
- ✅ Asignar Materiales
- ✅ Ver Asignaciones
- 🆕 **Registrar Horas Hoy** (nuevo)
- 🆕 **Ver Historial de Jornales** (nuevo)

## 🚀 Workflow de Usuario

1. Usuario entra a página **Obras**
2. Selecciona una obra de la tabla
3. Ve en el sidebar la sección **"Configuración de Obra"**
4. Click en **"📋 Registrar Horas Hoy"**:
   - Se abre modal con fecha de hoy (modificable)
   - Muestra tabla con profesionales asignados
   - Ingresa horas: 0.25, 0.5, 0.75, 1.0, 1.25, 1.5
   - Calcula automáticamente el monto a cobrar
   - Guarda todos los jornales del día
5. Click en **"📊 Ver Historial de Jornales"**:
   - Vista de resumen: Total por profesional
   - Vista de detalle: Lista completa de jornales
   - Filtros por fecha

## ✅ Testing

Una vez integrado, probar:
1. Registrar horas para profesionales asignados
2. Ver que aparezcan en el historial
3. Editar horas de un día existente
4. Verificar cálculos automáticos de montos
5. Filtrar por fechas en el historial

## 📝 Notas

- Los jornales requieren que los profesionales estén previamente asignados a la obra
- El sistema calcula automáticamente el monto basado en: `horas × tarifaDiaria`
- Se puede registrar hasta 1.5 días (36 horas) por jornal
- Los jornales se pueden editar volviendo a registrar el mismo día
- No se pueden duplicar jornales (misma fecha + profesional + obra)
