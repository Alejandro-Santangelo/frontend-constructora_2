# � Extracción de Elementos Individuales para Catálogo

## ✨ Funcionalidad Implementada

### Objetivo
Al guardar un presupuesto No Cliente, el sistema **extrae cada elemento individual** (materiales, jornales, gastos) y los guarda en el catálogo con **cantidad 1 y su precio unitario**, para que estén disponibles en futuros presupuestos.

---

## 🔄 Cómo Funciona

### En el PRESUPUESTO (cantidades reales)
- ✅ Se guarda TODO completo: 50 bolsas de cemento × $5,000 = $250,000
- ✅ Se guarda TODO completo: 50 bolsas de cal × $3,000 = $150,000
- ✅ Se guarda TODO completo: Oficial Juan - 5 jornales × $8,000 = $40,000

### En las TABLAS de CATÁLOGO (elementos individuales)
- ✅ Se crea: "Cemento" - 1 bolsa - $5,000
- ✅ Se crea: "Cal" - 1 bolsa - $3,000
- ✅ Se crea: "Juan Pérez - Oficial Albañil" - 1 jornal - $8,000

---

## 📋 Ejemplo Práctico Completo

### Presupuesto: Rubro "Albañilería"

**Agregas al presupuesto:**

**Materiales:**
- 50 bolsas de Cemento × $5,000 = $250,000
- 30 bolsas de Cal × $3,000 = $90,000
- 500 Ladrillos × $200 = $100,000

**Gastos Generales:**
- 1 Transporte × $20,000 = $20,000
- 1 Alquiler de herramientas × $15,000 = $15,000

**Jornales:**
- Juan Pérez (Oficial Albañil) - 5 jornales × $8,000 = $40,000
- Sin nombre (Ayudante Albañil) - 5 jornales × $5,000 = $25,000

---

## 🎯 Resultado Automático

### El presupuesto guarda TODO:
```
Rubro Albañilería - Total: $540,000
├─ Materiales: $440,000
│  ├─ 50 bolsas Cemento ($250,000)
│  ├─ 30 bolsas Cal ($90,000)
│  └─ 500 Ladrillos ($100,000)
├─ Gastos: $35,000
│  ├─ Transporte ($20,000)
│  └─ Herramientas ($15,000)
└─ Jornales: $65,000
   ├─ Juan Pérez - Oficial Albañil - 5 jornales ($40,000)
   └─ Ayudante Albañil - 5 jornales ($25,000)
```

### Las tablas de catálogo reciben (cantidad 1 cada uno):

**Tabla: materiales**
```javascript
[
  {
    nombre: "Cemento",
    categoria: "Albañilería",
    cantidad: 1,
    precioUnitario: 5000,
    unidadMedida: "bolsa"
  },
  {
    nombre: "Cal",
    categoria: "Albañilería",
    cantidad: 1,
    precioUnitario: 3000,
    unidadMedida: "bolsa"
  },
  {
    nombre: "Ladrillos",
    categoria: "Albañilería",
    cantidad: 1,
    precioUnitario: 200,
    unidadMedida: "unidad"
  }
]
```

**Tabla: gastos_generales**
```javascript
[
  {
    nombre: "Transporte",
    categoria: "Albañilería",
    cantidad: 1,
    precioUnitario: 20000,
    unidadMedida: "unidad"
  },
  {
    nombre: "Alquiler de herramientas",
    categoria: "Albañilería",
    cantidad: 1,
    precioUnitario: 15000,
    unidadMedida: "unidad"
  }
]
```

**Tabla: jornales**
```javascript
[
  {
    nombre: "Juan Pérez - Oficial Albañil",  // ← Con nombre
    rol: "Oficial Albañil",
    nombreProfesional: "Juan Pérez",
    categoria: "Albañilería",
    cantidad: 1,
    valorUnitario: 8000
  },
  {
    nombre: "Ayudante Albañil",  // ← Sin nombre, solo tipo
    rol: "Ayudante Albañil",
    nombreProfesional: null,
    categoria: "Albañilería",
    cantidad: 1,
    valorUnitario: 5000
  }
]
```

---

## 💡 Regla para Jornales/Profesionales

### SI tiene nombre:
```
Formato: "{Nombre} - {Tipo/Rol}"
Ejemplo: "Juan Pérez - Oficial Albañil"
```

### SI NO tiene nombre:
```
Formato: "{Tipo/Rol}"
Ejemplo: "Oficial Albañil"
```

---

## 🚀 Uso en Futuros Presupuestos

La próxima vez que hagas un presupuesto:

1. **Vas a Materiales** → Aparece "Cemento - $5,000/bolsa"
2. **Seleccionas** → Automáticamente aparece el precio
3. **Pones cantidad** → 100 bolsas
4. **Resultado** → 100 × $5,000 = $500,000

**Ahorras tiempo** porque no tienes que volver a buscar el precio.

---

## 📊 Información en el Payload

### Estructura enviada al backend:

```javascript
{
  // ... resto del presupuesto normal
  
  "elementosParaCatalogo": [
    // MATERIALES
    {
      "tipo": "MATERIAL",
      "nombre": "Cemento",
      "descripcion": "Cemento",
      "categoria": "Albañilería",
      "cantidad": 1,
      "precioUnitario": 5000,
      "unidadMedida": "bolsa",
      "rubroOrigen": "Albañilería"
    },
    
    // GASTOS
    {
      "tipo": "GASTO_GENERAL",
      "nombre": "Transporte",
      "descripcion": "Transporte",
      "categoria": "Albañilería",
      "cantidad": 1,
      "precioUnitario": 20000,
      "unidadMedida": "unidad",
      "rubroOrigen": "Albañilería"
    },
    
    // JORNALES (con nombre)
    {
      "tipo": "JORNAL",
      "nombre": "Juan Pérez - Oficial Albañil",
      "rol": "Oficial Albañil",
      "nombreProfesional": "Juan Pérez",
      "categoria": "Albañilería",
      "cantidad": 1,
      "valorUnitario": 8000,
      "rubroOrigen": "Albañilería"
    },
    
    // JORNALES (sin nombre)
    {
      "tipo": "JORNAL",
      "nombre": "Ayudante Albañil",
      "rol": "Ayudante Albañil",
      "nombreProfesional": null,
      "categoria": "Albañilería",
      "cantidad": 1,
      "valorUnitario": 5000,
      "rubroOrigen": "Albañilería"
    }
  ]
}
```

---

## 🎨 Retroalimentación al Usuario

Después de guardar, aparece en consola:

```
✅ Presupuesto guardado exitosamente.

📚 ELEMENTOS AGREGADOS AL CATÁLOGO (disponibles para reutilizar):

   📦 3 Material(es) individual(es)
   💰 2 Gasto(s) general(es)
   👷 2 Jornal(es)

💡 Cada elemento está guardado con cantidad 1 y su precio unitario.
   Ya están disponibles en el catálogo para usarlos en futuros presupuestos.
```

---

## 🔍 Logs Detallados (Consola)

```
📦 Material para catálogo: "Cemento" - $5000 (Albañilería)
📦 Material para catálogo: "Cal" - $3000 (Albañilería)
📦 Material para catálogo: "Ladrillos" - $200 (Albañilería)
💰 Gasto para catálogo: "Transporte" - $20000 (Albañilería)
💰 Gasto para catálogo: "Alquiler de herramientas" - $15000 (Albañilería)
👷 Jornal para catálogo: "Juan Pérez - Oficial Albañil" - $8000/jornal (Albañilería)
👷 Jornal para catálogo: "Ayudante Albañil" - $5000/jornal (Albañilería)

📚 ELEMENTOS EXTRAÍDOS PARA CATÁLOGO: 7 elementos individuales
   📦 Materiales: 3
   💰 Gastos Generales: 2
   👷 Jornales: 2
   👨‍💼 Profesionales: 0
```

---

## ⚙️ Validaciones Automáticas

### Se INCLUYE en catálogo:
- ✅ Materiales con descripción y precio > 0
- ✅ Gastos con descripción y precio > 0
- ✅ Jornales con rol/nombre y precio > 0
- ✅ Profesionales con tipo/nombre y precio > 0

### Se EXCLUYE del catálogo:
- ❌ Elementos sin nombre/descripción
- ❌ Elementos con precio = 0
- ❌ Elementos duplicados (el backend debe validar)

---

## 🎯 Responsabilidad del Backend

El backend debe:

1. **Recibir** el array `elementosParaCatalogo` del payload
2. **Validar** cada elemento:
   - Verificar que no exista ya (por nombre + empresaId)
   - Validar que tenga precio > 0
   - Validar que tenga descripción/nombre
3. **Crear** registros en las tablas correspondientes:
   - `tipo: "MATERIAL"` → tabla `materiales`
   - `tipo: "GASTO_GENERAL"` → tabla `gastos_generales`
   - `tipo: "JORNAL"` → tabla `jornales`
   - `tipo: "PROFESIONAL"` → tabla `profesionales`
4. **Evitar duplicados**: Si ya existe, no crear (o actualizar precio si es diferente)
5. **Retornar** confirmación de elementos creados

---

## 🔧 Implementación en Backend (Sugerencia)

### Endpoint sugerido:
```
POST /api/v1/presupuestos-no-cliente/:id
```

### Procesamiento:
```java
// Pseudocódigo
for (elemento in payload.elementosParaCatalogo) {
  switch (elemento.tipo) {
    case "MATERIAL":
      // Verificar si existe: SELECT * FROM materiales WHERE nombre = ? AND empresaId = ?
      if (!existe) {
        // Crear: INSERT INTO materiales (nombre, precioUnitario, categoria, ...)
      }
      break;
    
    case "GASTO_GENERAL":
      if (!existe) {
        // INSERT INTO gastos_generales ...
      }
      break;
    
    case "JORNAL":
      if (!existe) {
        // INSERT INTO jornales ...
      }
      break;
  }
}
```

---

## 📅 Información Técnica

**Fecha de Implementación:** 12 de enero de 2026

**Archivos Modificados:**
- `src/components/PresupuestoNoClienteModal.jsx` (líneas ~7475-7590)
- Función: `prepararDatosParaEnvio()`
- Variable: `payload.elementosParaCatalogo`

**Compatibilidad:**
- ✅ Modo Detalle (agregar rubros con elementos individuales)
- ✅ Funciona con jornales con y sin nombre
- ✅ Compatible con profesionales
- ❌ NO aplica en modo global (solo crea 1 elemento)
- ❌ NO aplica en modo manual

---

## 💼 Casos de Uso

### Caso 1: Construcción de Casa
**Primera vez:**
- Creas presupuesto con "Albañilería"
- Agregas: Cemento, Cal, Ladrillos, etc.
- Se guardan todos esos materiales en el catálogo

**Segunda casa:**
- Los materiales ya están en el catálogo
- Solo los seleccionas y cambias cantidades
- ⏱️ Ahorras 80% del tiempo

### Caso 2: Empresa con Múltiples Proyectos
- Todos los presupuestos alimentan el catálogo
- El catálogo crece automáticamente
- Precios se mantienen actualizados
- Base de conocimiento compartida

---

## ❓ Preguntas Frecuentes

### ¿Se duplican los elementos si ya existen?
**No.** El backend debe validar antes de crear. Si ya existe "Cemento" en la categoría "Albañilería", no lo crea de nuevo.

### ¿Qué pasa si el precio cambió?
**Opción 1:** No actualizar (mantener precio original)
**Opción 2:** Actualizar precio (usar el más reciente)
**Recomendado:** Mantener original y crear versión con fecha.

### ¿Se puede desactivar esta funcionalidad?
**Sí.** Simplemente el backend puede ignorar el array `elementosParaCatalogo`.

### ¿Funciona con trabajos extra?
**Sí.** Cualquier presupuesto que tenga rubros con elementos individuales.

---

## 🎨 Mejoras Futuras Sugeridas

1. **Panel de administración de catálogo**: Ver y editar elementos guardados
2. **Historial de precios**: Guardar cambios de precio en el tiempo
3. **Elementos favoritos**: Marcar los más usados
4. **Importar/Exportar catálogo**: Compartir entre empresas
5. **Sugerencias inteligentes**: Basadas en presupuestos anteriores

---

## 🏁 Resumen Ejecutivo

**Antes:** Cada presupuesto se hacía desde cero.

**Ahora:** Cada presupuesto alimenta el catálogo automáticamente.

**Resultado:** 
- ⏱️ Menos tiempo creando presupuestos
- 📊 Base de datos de precios actualizada
- 💰 Estimaciones más precisas
- 🚀 Productividad aumentada

---

¿Necesitas ayuda con la implementación en el backend? ¡Avísame!

---

## 🔄 Cómo Funciona

### Antes (solo modo global)
- ✅ Modo Global: Creaba 1 elemento con nombre + importe total
- ❌ Modo Detalle: NO creaba elementos reutilizables

### Ahora (modo detalle mejorado)
- ✅ Modo Global: Sigue funcionando igual
- ✅ **Modo Detalle**: Ahora TAMBIÉN crea elementos consolidados automáticamente

---

## 📋 Ejemplo Práctico

### Cuando creas un rubro "Albañilería" con:

**Materiales:**
- Cemento: 10 bolsas × $5,000 = $50,000
- Ladrillos: 500 u × $200 = $100,000
- Arena: 2 m³ × $15,000 = $30,000
- **TOTAL MATERIALES: $180,000**

**Gastos Generales:**
- Transporte: $20,000
- Herramientas: $15,000
- **TOTAL GASTOS: $35,000**

**Jornales:**
- Oficial Albañil: 5 jornales × $8,000 = $40,000
- Ayudante Albañil: 5 jornales × $5,000 = $25,000
- **TOTAL JORNALES: $65,000**

---

## 🎯 Resultado: Elementos Consolidados Creados

El sistema creará automáticamente 3 elementos en el catálogo:

### 1. Material Consolidado
```javascript
{
  tipo: "MATERIAL",
  nombre: "Albañilería",
  categoria: "Rubros Consolidados",
  descripcion: "Materiales para Albañilería",
  importeUnitario: 180000,
  cantidad: 1,
  unidadMedida: "rubro",
  esConsolidado: true,
  cantidadElementos: 3 // (Cemento, Ladrillos, Arena)
}
```

### 2. Gasto General Consolidado
```javascript
{
  tipo: "GASTO_GENERAL",
  nombre: "Albañilería",
  categoria: "Rubros Consolidados",
  descripcion: "Gastos generales para Albañilería",
  importeUnitario: 35000,
  cantidad: 1,
  unidadMedida: "rubro",
  esConsolidado: true,
  cantidadElementos: 2 // (Transporte, Herramientas)
}
```

### 3. Jornal Consolidado
```javascript
{
  tipo: "JORNAL",
  nombre: "Albañilería",
  rol: "Albañilería (Consolidado)",
  descripcion: "Mano de obra para Albañilería",
  importeUnitario: 65000,
  cantidad: 1,
  esConsolidado: true,
  cantidadElementos: 2 // (Oficial, Ayudante)
}
```

---

## 💡 Ventajas

### 1. **Reutilización Rápida**
En un nuevo presupuesto, puedes seleccionar directamente:
- "Albañilería" (Material) → $180,000
- "Albañilería" (Gasto) → $35,000
- "Albañilería" (Jornal) → $65,000

### 2. **Base de Conocimiento**
Se va construyendo una biblioteca de costos por rubro basada en presupuestos reales.

### 3. **Estimaciones Más Precisas**
Los valores consolidados reflejan costos reales de proyectos anteriores.

### 4. **Flexibilidad**
- Puedes usar el elemento consolidado completo
- O desglosarlo en elementos individuales según necesites

---

## 🔍 Identificación en el Catálogo

Los elementos consolidados se identifican por:

1. **Categoría**: "Rubros Consolidados"
2. **Flag**: `esConsolidado: true`
3. **Unidad de Medida**: "rubro"
4. **Nombre**: Igual al nombre del rubro original

---

## 📊 Información Almacenada

Cada elemento consolidado guarda:

- ✅ **Nombre del rubro** (ej: "Albañilería")
- ✅ **Importe total** del concepto
- ✅ **Cantidad de elementos** que lo componen
- ✅ **Detalle de elementos** originales (para referencia)
- ✅ **Descripción** personalizada (si se ingresó)

---

## 🚀 Integración con el Backend

### Payload Enviado

```javascript
{
  // ... resto del presupuesto
  
  "elementosConsolidadosPorRubro": [
    {
      "tipo": "MATERIAL",
      "nombre": "Albañilería",
      "importeUnitario": 180000,
      // ...
    },
    {
      "tipo": "GASTO_GENERAL",
      "nombre": "Albañilería",
      "importeUnitario": 35000,
      // ...
    },
    {
      "tipo": "JORNAL",
      "nombre": "Albañilería",
      "importeUnitario": 65000,
      // ...
    }
  ]
}
```

### Responsabilidad del Backend

El backend debe:

1. **Verificar** si ya existe un elemento consolidado con ese nombre
2. **Si NO existe**: Crearlo en la tabla correspondiente
3. **Si existe**: Opcionalmente actualizarlo o mantener el original
4. **Retornar** confirmación de los elementos creados

---

## 🎨 UX - Retroalimentación al Usuario

Después de guardar, el usuario ve en la consola:

```
✅ Presupuesto guardado exitosamente.

📦 ELEMENTOS CONSOLIDADOS CREADOS (disponibles para reutilizar):

   🔹 1 Material(es) consolidado(s)
   🔹 1 Gasto(s) general(es) consolidado(s)
   🔹 1 Jornal(es) consolidado(s)

💡 Estos elementos están ahora disponibles en el catálogo para usarlos en futuros presupuestos.
```

---

## 🔧 Configuración

### Elementos que SE CONSOLIDAN:
- ✅ Rubros en modo detalle
- ✅ Con nombre de rubro (`tipoProfesional`)
- ✅ Con subtotales > 0

### Elementos que NO SE CONSOLIDAN:
- ❌ Rubros en modo manual (`esModoManual: true`)
- ❌ Rubros globales (`esGlobal: true`)
- ❌ Gastos generales sin rubro asociado
- ❌ Rubros sin nombre

---

## 📝 Logs de Desarrollo

Para debugging, el sistema registra en consola:

```javascript
✅ Elemento consolidado MATERIAL creado: "Albañilería" - $180,000
✅ Elemento consolidado GASTO creado: "Albañilería" - $35,000
✅ Elemento consolidado JORNAL creado: "Albañilería" - $65,000

📦 ELEMENTOS CONSOLIDADOS GENERADOS: 3 elementos
   - MATERIAL: Albañilería - $180,000 (3 elementos)
   - GASTO_GENERAL: Albañilería - $35,000 (2 elementos)
   - JORNAL: Albañilería - $65,000 (2 elementos)
```

---

## 🎯 Próximos Pasos (Backend)

Para que esta funcionalidad sea completamente operativa, el backend debe:

1. **Recibir** el array `elementosConsolidadosPorRubro`
2. **Procesar** cada elemento según su tipo
3. **Crear registros** en las tablas:
   - `materiales` (tipo: MATERIAL)
   - `gastos_generales` (tipo: GASTO_GENERAL)
   - `jornales` (tipo: JORNAL)
4. **Evitar duplicados** (verificar por nombre + empresaId)
5. **Retornar** confirmación o errores

---

## 📅 Fecha de Implementación
**12 de enero de 2026**

## 👤 Autor
Sistema de Gestión de Presupuestos - Constructoras

---

## 🔗 Archivos Relacionados

- `src/components/PresupuestoNoClienteModal.jsx` (líneas 7450-7565)
- Función: `prepararDatosParaEnvio()`
- Variable: `payload.elementosConsolidadosPorRubro`
