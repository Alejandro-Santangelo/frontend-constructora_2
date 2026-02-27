# Ejemplo de Uso: Modal Presupuesto Unificado

## Importar en ObrasPage.jsx

```jsx
import ModalPresupuestoUnificado from '../components/ModalPresupuestoUnificado';
import { TIPOS_PRESUPUESTO } from '../constants/presupuestoTypes';
import { crearPresupuesto } from '../services/presupuestoUnificadoService';
```

## Estado del componente

```jsx
// Reemplazar estados existentes de modales separados
const [modalPresupuesto, setModalPresupuesto] = useState({
  mostrar: false,
  tipo: null,
  contexto: {},
  datosIniciales: null
});
```

## Funciones para abrir modales

### 1. Crear Obra Principal (TRADICIONAL)

```jsx
const abrirModalObraPrincipal = () => {
  setModalPresupuesto({
    mostrar: true,
    tipo: TIPOS_PRESUPUESTO.TRADICIONAL,
    contexto: {},
    datosIniciales: null
  });
};
```

**Botón en UI:**
```jsx
<button 
  className="btn btn-primary"
  onClick={abrirModalObraPrincipal}
>
  <i className="fas fa-plus me-2"></i>
  Nueva Obra Principal
</button>
```

---

### 2. Crear Trabajo Diario (TRABAJO_DIARIO)

```jsx
const abrirModalTrabajoDiario = () => {
  setModalPresupuesto({
    mostrar: true,
    tipo: TIPOS_PRESUPUESTO.TRABAJO_DIARIO,
    contexto: {},
    datosIniciales: null
  });
};
```

**Botón en UI:**
```jsx
<button 
  className="btn btn-success"
  onClick={abrirModalTrabajoDiario}
>
  <i className="fas fa-calendar-day me-2"></i>
  Trabajo Diario - Nuevo Cliente
</button>
```

---

### 3. Crear Adicional Obra (TRABAJO_EXTRA) - HIJO

```jsx
// Desde la obra principal
const abrirModalAdicionalObra = (obra) => {
  setModalPresupuesto({
    mostrar: true,
    tipo: TIPOS_PRESUPUESTO.TRABAJO_EXTRA,
    contexto: {
      obraId: obra.id,
      obraNombre: obra.nombre
    },
    datosIniciales: null
  });
};
```

**Botón en UI:**
```jsx
{/* En la sección de configuración de la obra */}
<button 
  className="btn btn-warning"
  onClick={() => abrirModalAdicionalObra(obraActual)}
>
  <i className="fas fa-wrench me-2"></i>
  Nuevo Adicional Obra
</button>
```

---

### 4. Crear Tarea Leve HIJA (de obra principal)

```jsx
const abrirModalTareaLeveHija = (obra) => {
  setModalPresupuesto({
    mostrar: true,
    tipo: TIPOS_PRESUPUESTO.TAREA_LEVE,
    contexto: {
      obraId: obra.id,
      obraNombre: obra.nombre,
      trabajoExtraId: null // ← NULL = HIJA directa
    },
    datosIniciales: null
  });
};
```

**Botón en UI:**
```jsx
{/* En "Gestionar Tareas Leves" de la obra principal */}
<button 
  className="btn btn-primary"
  onClick={() => abrirModalTareaLeveHija(obraActual)}
>
  <i className="fas fa-plus me-2"></i>
  Nueva Tarea Leve
</button>
```

---

### 5. Crear Tarea Leve NIETA (de trabajo extra)

```jsx
const abrirModalTareaLeveNieta = (obra, trabajoExtra) => {
  setModalPresupuesto({
    mostrar: true,
    tipo: TIPOS_PRESUPUESTO.TAREA_LEVE,
    contexto: {
      obraId: obra.id,
      obraNombre: obra.nombre,
      trabajoExtraId: trabajoExtra.id, // ← Padre directo
      trabajoExtraNombre: trabajoExtra.nombre
    },
    datosIniciales: null
  });
};
```

**Botón en UI:**
```jsx
{/* En "Gestionar Tareas Leves" del trabajo extra */}
<button 
  className="btn btn-purple"
  onClick={() => abrirModalTareaLeveNieta(obraActual, trabajoExtraActual)}
>
  <i className="fas fa-plus me-2"></i>
  Nueva Tarea Leve (para este adicional)
</button>
```

---

## Función de guardado unificada

```jsx
const handleGuardarPresupuesto = async (datos) => {
  try {
    console.log('💾 Guardando presupuesto:', datos);

    // Usar servicio unificado
    const resultado = await crearPresupuesto(
      datos,
      empresaId
    );

    console.log('✅ Presupuesto creado:', resultado);

    // Recargar listas
    await cargarObras();
    await cargarPresupuestos();

    // Notificación
    showNotification(
      `✅ ${getConfigPresupuesto(datos.tipoPresupuesto).label} creado correctamente`,
      'success'
    );

    return resultado;
  } catch (error) {
    console.error('❌ Error al crear presupuesto:', error);
    throw error;
  }
};
```

---

## Renderizar el modal

```jsx
{/* Un solo modal para todos los tipos */}
<ModalPresupuestoUnificado
  mostrar={modalPresupuesto.mostrar}
  tipoPresupuesto={modalPresupuesto.tipo}
  contexto={modalPresupuesto.contexto}
  datosIniciales={modalPresupuesto.datosIniciales}
  onGuardar={handleGuardarPresupuesto}
  onCerrar={() => setModalPresupuesto({
    mostrar: false,
    tipo: null,
    contexto: {},
    datosIniciales: null
  })}
/>
```

---

## Migración: Reemplazar modales antiguos

### ANTES (múltiples modales):

```jsx
{mostrarModalCrearObra && <ModalCrearObra ... />}
{mostrarModalTrabajoDiario && <ModalTrabajoDiario ... />}
{mostrarModalTrabajoAdicional && <ModalTrabajoAdicional ... />}
{mostrarModalTareaLeve && <ModalTareaLeve ... />}
```

### DESPUÉS (un solo modal):

```jsx
<ModalPresupuestoUnificado
  mostrar={modalPresupuesto.mostrar}
  tipoPresupuesto={modalPresupuesto.tipo}
  contexto={modalPresupuesto.contexto}
  datosIniciales={modalPresupuesto.datosIniciales}
  onGuardar={handleGuardarPresupuesto}
  onCerrar={() => setModalPresupuesto({
    mostrar: false,
    tipo: null,
    contexto: {},
    datosIniciales: null
  })}
/>
```

---

## Visualización de títulos según contexto

### Modal para Obra Principal:
```
┌─────────────────────────────────────────────┐
│  🏗️ Presupuesto para Obra Principal         │
│                                             │
│  [Formulario completo con cliente]          │
└─────────────────────────────────────────────┘
```

### Modal para Trabajo Diario:
```
┌─────────────────────────────────────────────┐
│  📅 Presupuesto para Trabajo Diario -       │
│      Nuevo Cliente                          │
│                                             │
│  [Formulario simplificado, auto-aprueba]    │
└─────────────────────────────────────────────┘
```

### Modal para Adicional Obra:
```
┌─────────────────────────────────────────────┐
│  🔧 Presupuesto para Adicional Obra         │
│  📎 Vinculado a obra: Casa de Cacho        │
│                                             │
│  [Formulario vinculado a obra]              │
└─────────────────────────────────────────────┘
```

### Modal para Tarea Leve (HIJA):
```
┌─────────────────────────────────────────────┐
│  📋 Presupuesto para Tarea Leve             │
│  📎 Vinculado a obra: Casa de Cacho        │
│                                             │
│  [Formulario simplificado: nombre, $, días] │
└─────────────────────────────────────────────┘
```

### Modal para Tarea Leve (NIETA):
```
┌─────────────────────────────────────────────┐
│  📋 Presupuesto para Tarea Leve             │
│  📎 Vinculada a: Casa de Cacho - Quincho   │
│     → de la obra: Casa de Cacho            │
│                                             │
│  [Formulario simplificado]                  │
└─────────────────────────────────────────────┘
```

---

## Ventajas de esta implementación

✅ **Un solo modal** para 4 tipos
✅ **Título dinámico** según tipo
✅ **Contexto visual** (hija/nieta)
✅ **Formulario adaptativo** según tipo
✅ **Estilos consistentes** con gradientes
✅ **Validación unificada**
✅ **Menos código** a mantener

---

## Próximos pasos

1. ✅ Crear archivo de constantes (`presupuestoTypes.js`)
2. ✅ Crear servicio unificado (`presupuestoUnificadoService.js`)
3. ✅ Crear modal unificado (`ModalPresupuestoUnificado.jsx`)
4. ⏳ Integrar en ObrasPage.jsx
5. ⏳ Eliminar modales antiguos
6. ⏳ Actualizar badges en tabla de presupuestos
7. ⏳ Coordinar con backend para agregar campo `tipoPresupuesto`
