# 📋 ESPECIFICACIÓN TÉCNICA: TRABAJOS EXTRA - PERSISTENCIA EN BACKEND

**Documento para equipo de Backend**  
**Fecha:** 09/02/2026  
**Versión:** 2.0  
**Estado:** ✅ VALIDADO CON BACKEND REAL

---

## 🎯 RESUMEN EJECUTIVO

Los **Trabajos Extra** en el sistema son presupuestos independientes vinculados a una obra. Actualmente el frontend puede:
- ✅ Crear trabajos extra
- ✅ Ver sus detalles
- ❌ **Asignar profesionales/materiales/gastos correctamente** (PROBLEMA)
- ❌ **Gestionar etapas diarias** (PROBLEMA)

**El problema:** Las asignaciones se guardan en tablas relacionales (`asignaciones_profesional_obra`, etc.) pero **NO se persisten en `itemsCalculadora` del trabajo extra**.

**La solución requerida:** Hacer que el trabajo extra funcione como un presupuesto-no-cliente independiente, guardando TODO dentro de `itemsCalculadora[]`.

---

## 📊 DIFERENCIAS: OBRA NORMAL vs TRABAJO EXTRA

| Aspecto | Obra Normal | Trabajo Extra |
|---------|-------------|---------------|
| **Endpoint asignación** | `POST /api/profesionales/asignar-semanal` | `PUT /api/v1/trabajos-extra/{id}` |
| **Almacenamiento** | Tablas relacionales (`asignaciones_profesional_obra`) | `itemsCalculadora[]` (JSON en BD) |
| **Persistencia** | Múltiples tablas (profesionales, materiales, gastos) | Un solo objeto JSON completo |
| **Actualización** | Crear/editar/eliminar registros individuales | Reemplazar `itemsCalculadora` completo |
| **Endpoint materiales** | `POST /api/materiales/asignar` | `PUT /api/v1/trabajos-extra/{id}` |
| **Endpoint gastos** | `POST /api/gastos/asignar` | `PUT /api/v1/trabajos-extra/{id}` |
| **Método HTTP** | POST (crear) / DELETE (eliminar) | PUT (actualizar completo) |
| **Relación con presupuesto** | Presupuesto-no-cliente independiente con ID | Trabajo extra ES el presupuesto |
| **Endpoint presupuesto** | `/api/presupuestos-no-cliente/{id}` | `/api/v1/trabajos-extra/{id}` ⚠️ |

**⚠️ IMPORTANTE:** Los trabajos extra NO son presupuestos-no-cliente tradicionales. No tienen registro en tabla `presupuestos_no_cliente`, por eso los endpoints de presupuestos fallan con error 400/500.

---

## 📊 ESTRUCTURA DE DATOS ESPERADA

### Objeto Trabajo Extra (Respuesta GET)

```json
{
  "id": 8,
  "obraId": 7,
  "nombre": "Casa de Pilo-Quincho",
  "nombreObra": "Casa de Pilo-Quincho",
  "descripcion": "Trabajo adicional - Quincho",
  "estado": "BORRADOR",
  "esTrabajoExtra": true,
  "fechaProbableInicio": "2026-02-16",
  "vencimiento": "2026-03-15",
  "tiempoEstimadoTerminacion": 15,
  
  "🔑 CRÍTICO - ITEMSCALCULADORA": [
    {
      "id": 1001,
      "tipoProfesional": "Albañil",
      "descripcion": "Construcción de quincho",
      
      "⚠️ CAMPOS OBLIGATORIOS DEL ITEM":
      "esModoManual": false,
      "esRubroVacio": false,
      "esGastoGeneral": false,
      "incluirEnCalculoDias": true,
      "trabajaEnParalelo": true,
      
      "cantidadJornales": 5.0,
      "importeJornal": 15000.00,
      "subtotalManoObra": 75000.00,
      "total": 125000.00,
      
      "🟠 PROFESIONALES ASIGNADOS": [
        {
          "⚠️ CAMPOS OBLIGATORIOS":
          "rol": "Albañil Oficial",
          "nombreCompleto": "Carlos Gómez",
          "cantidadJornales": 5.0,
          "valorJornal": 15000.00,
          "subtotal": 75000.00,
          
          "⚪ CAMPOS OPCIONALES":
          "profesionalObraId": 101,
          "incluirEnCalculoDias": true,
          "observaciones": "Albañil matriculado",
          "frontendId": 999
        }
      ],
      
      "jornales": [],
      
      "🟢 MATERIALES ASIGNADOS": [
        {
          "obraMaterialId": 201,
          "nombre": "Ladrillo Fiscal",
          "descripcion": "Ladrillo fiscal premium",
          "unidad": "m3",
          "cantidad": 20,
          "precio": 1500,
          "subtotal": 30000,
          "observaciones": "De primera calidad"
        }
      ],
      
      "🔵 GASTOS GENERALES": [
        {
          "descripcion": "Transporte de materiales",
          "cantidad": 1,
          "precioUnitario": 5000,
          "subtotal": 5000,
          "sinCantidad": false,
          "sinPrecio": false,
          "orden": 1,
          "observaciones": "Flete desde depósito"
        }
      ]
    }
  ],
  
  "🔴 ETAPAS DIARIAS (DÍAS)": [
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-02-20"
  ],
  
  "honorariosOtrosCostosActivo": true,
  "honorariosOtrosCostosValor": 15,
  "honorariosOtrosCostosTipo": "PORCENTAJE",
  "mayoresCostosOtrosCostosActivo": true,
  "mayoresCostosOtrosCostosValor": 5,
  "mayoresCostosOtrosCostosTipo": "PORCENTAJE",
  
  "totalPresupuesto": 125000,
  "totalHonorarios": 18750,
  "totalMayoresCostos": 7187.50,
  "totalFinal": 150937.50
}
```

---

## 🔗 ENDPOINTS REQUERIDOS

### 1️⃣ OBTENER TRABAJO EXTRA COMPLETO

**Endpoint:** `GET /api/v1/trabajos-extra/{id}`

**Headers:**
```
X-Tenant-ID: 1
empresaId: 1
```

**Response:** 
- Status: 200
- Body: Objeto trabajo extra completo (ver estructura arriba)

**Requisitos:**
- ✅ Devolver `itemsCalculadora[]` completo
- ✅ Incluir profesionales dentro de cada item
- ✅ Incluir materiales dentro de cada item
- ✅ Incluir gastos generales dentro de cada item
- ✅ Devolver `dias[]` con etapas
- ✅ Devolver todas las configuraciones de honorarios y mayores costos

---

### 2️⃣ ACTUALIZAR TRABAJO EXTRA (PUT COMPLETO)

**Endpoint:** `PUT /api/v1/trabajos-extra/{id}?empresaId={empresaId}`

**Headers:**
```
Content-Type: application/json
empresaId: 1  (opcional si va en query param)
```

**Request Body Completo (CON TODOS LOS CAMPOS OBLIGATORIOS):**
```json
{
  "obraId": 7,
  "nombre": "Casa de Pilo-Quincho - ACTUALIZADO",
  "descripcion": "Trabajo actualizado",
  "fechaProbableInicio": "2026-02-16",
  "vencimiento": "2026-03-15",
  "tiempoEstimadoTerminacion": 20,
  
  "itemsCalculadora": [
    {
      "tipoProfesional": "Albañil",
      "descripcion": "Construcción de quincho",
      
      "⚠️ CAMPOS OBLIGATORIOS DEL ITEM":
      "esModoManual": false,
      "esRubroVacio": false,
      "esGastoGeneral": false,
      "incluirEnCalculoDias": true,
      "trabajaEnParalelo": true,
      
      "cantidadJornales": 5.0,
      "importeJornal": 15000.00,
      "subtotalManoObra": 75000.00,
      "total": 75000.00,
      
      "profesionales": [
        {
          "rol": "Albañil Oficial",
          "nombreCompleto": "Carlos Gómez",
          "cantidadJornales": 5.0,
          "valorJornal": 15000.00,
          "subtotal": 75000.00,
          "incluirEnCalculoDias": true,
          "observaciones": "Albañil matriculado"
        }
      ],
      
      "materialesLista": [
        {
          "nombre": "Ladrillo Fiscal",
          "unidad": "m3",
          "cantidad": 20.0,
          "precio": 1500.00,
          "subtotal": 30000.00
        }
      ],
      
      "gastosGenerales": [
        {
          "descripcion": "Transporte de materiales",
          "cantidad": 1.0,
          "precioUnitario": 5000.00,
          "subtotal": 5000.00
        }
      ],
      
      "jornales": []
    }
  ],
  
  "dias": [
    "2026-02-16",
    "2026-02-17",
    "2026-02-18"
  ]
}
```

**Ejemplo MÍNIMO (Solo 1 profesional sin materiales/gastos):**
```json
{
  "obraId": 7,
  "nombre": "Trabajo Extra Test",
  
  "itemsCalculadora": [
    {
      "tipoProfesional": "Electricista",
      "esModoManual": false,
      "esRubroVacio": false,
      "esGastoGeneral": false,
      "incluirEnCalculoDias": true,
      "trabajaEnParalelo": true,
      "cantidadJornales": 2.0,
      "importeJornal": 15000.00,
      "subtotalManoObra": 30000.00,
      "total": 30000.00,
      
      "profesionales": [
        {
          "rol": "Electricista",
          "nombreCompleto": "Juan Pérez",
          "cantidadJornales": 2.0,
          "valorJornal": 15000.00,
          "subtotal": 30000.00
        }
      ],
      
      "materialesLista": [],
      "gastosGenerales": [],
      "jornales": []
    }
  ]
}
```

**Response:**
- Status: 200
- Body: Trabajo extra actualizado completo
- Mensaje: "Trabajo extra actualizado exitosamente"

**Requisitos CRÍTICOS:**
- ✅ Reemplazar `itemsCalculadora` completamente (delete old + insert new)
- ✅ NO actualizarse en tablas relacionales (`asignaciones_profesional_obra`, etc.)
- ✅ Persistir profesionales DENTRO de `itemsCalculadora[].profesionales`
- ✅ Persistir materiales DENTRO de `itemsCalculadora[].materialesLista`
- ✅ Persistir gastos DENTRO de `itemsCalculadora[].gastosGenerales`
- ✅ Actualizar `dias[]` para etapas
- ✅ Recalcular totales automáticamente
- ✅ Validar que todos los IDs sean válidos

---

### 3️⃣ ACTUALIZAR TRABAJO EXTRA (PATCH PARCIAL)

**Endpoint:** `PATCH /api/v1/trabajos-extra/{id}`

**Headers:**
```
X-Tenant-ID: 1
empresaId: 1
Content-Type: application/json
```

**Request Body (ejemplo: solo agregar profesional a un item):**
```json
{
  "itemsCalculadora": [
    {
      "id": 1001,
      "profesionales": [
        {
          "nombreCompleto": "Pedro López",
          "rol": "Ayudante",
          "cantidadJornales": 3,
          "valorJornal": 8000,
          "subtotal": 24000
        }
      ]
    }
  ]
}
```

**Response:**
- Status: 200
- Body: Trabajo extra actualizado

**Requisitos:**
- ✅ Permitir actualización parcial
- ✅ Preservar items no actualizados
- ✅ Merging inteligente de arrays

---

### 4️⃣ LISTAR TRABAJOS EXTRA DE UNA OBRA

**Endpoint:** `GET /api/v1/trabajos-extra?obraId={obraId}&empresaId={empresaId}`

**Response:**
- Status: 200
- Body: Array de trabajos extra con estructura completa

**Requisitos:**
- ✅ Incluir `itemsCalculadora` completo para cada trabajo extra
- ✅ Incluir `dias[]` para cada trabajo extra

---

## ⚠️ PROBLEMAS DETECTADOS EN FRONTEND

### Problema 1: Asignaciones a Tablas Relacionales
```
❌ POST /api/profesionales/asignar-semanal
   → Guarda en asignaciones_profesional_obra
   → NO actualiza itemsCalculadora del trabajo extra
```

### Problema 2: Endpoints de Presupuestos No Aplican
```
❌ GET /api/presupuestos-no-cliente/8/gastos-generales
   → Error 400/500 porque 8 es ID de trabajo extra, no presupuesto
   → Trabajo extra NO es presupuesto-no-cliente tradicional
```

### Problema 3: Sin Persistencia en `itemsCalculadora`
```
❌ Cuando se asignan profesionales/materiales/gastos
   → NO se actualizan en itemsCalculadora
   → NO hay PUT a /api/v1/trabajos-extra/{id}
   → Datos se pierden al refrescar la página
```

---

## 🔍 PREGUNTAS CRÍTICAS PARA BACKEND

### 1. ¿Manejo actual de `itemsCalculadora`?
```
- ¿El backend actualiza itemsCalculadora en PUT /trabajos-extra/{id}?
- ¿O solo maneja tablas relacionales?
- ¿Hay lógica para persistir profesionales DENTRO de itemsCalculadora?
```

### 2. ¿Cascada de borrado?
```
- Cuando se hace PUT con array vacío de profesionales
- ¿Se borran los profesionales anteriores correctamente?
- ¿O quedan registros huérfanos?
```

### 3. ¿Validaciones?
```
- ¿Se validan profesionales válidos (ID existe)?
- ¿Se validan materiales válidos?
- ¿Se valida que las fechas en dias[] sean válidas?
```

### 4. ¿Cálculo de totales?
```
- ¿Se recalculan totalPresupuesto/totalHonorarios/totalFinal?
- ¿Se aplican honorarios y mayores costos correctamente?
- ¿Sobre qué base? (¿mano de obra?, ¿materiales?, ¿ambos?)
```

### 5. ¿Independencia de tablas relacionales?
```
- ¿El trabajo extra puede funcionar sin tocar asignaciones_profesional_obra?
- ¿O es obligatorio guardar allí también?
- ¿Esto crea conflictos o data duplication?
```

---

## 📝 CASOS DE USO A VALIDAR

### Caso 1: Asignar Profesional a Trabajo Extra
```
1. Usuario abre trabajo extra 8
2. Click en "Asignar Profesionales"
3. Modal: Selecciona "Carlos Gómez" + 5 jornales
4. Click "Guardar"

ESPERADO:
- PUT /api/v1/trabajos-extra/8
- itemsCalculadora[0].profesionales = [{nombreCompleto: "Carlos Gómez", ...}]
- BD: trabajo extra actualizado
- Frontend: Muestra badge "1 profesional"
- Refresh: Datos persisten

ACTUAL:
❌ POST a asignaciones_profesional_obra
❌ La no se actualiza itemsCalculadora
❌ Refresh: Datos desaparecen
```

### Caso 2: Asignar Material
```
1. Usuario abre trabajo extra 8
2. Click en "Asignar Materiales"
3. Modal: Selecciona "Ladrillo Fiscal" + 20 m3
4. Click "Guardar"

ESPERADO:
- PUT /api/v1/trabajos-extra/8
- itemsCalculadora[0].materialesLista = [{nombre: "Ladrillo...", ...}]
- BD: trabajo extra actualizado
- Frontend: Muestra badge "1 material"
- Refresh: Datos persisten

ACTUAL:
❌ Error 400/500 (endpoint presupuesto no existe)
❌ No se guarda nada
```

### Caso 3: Asignar Gastos Generales
```
1. Usuario abre trabajo extra 8
2. Click en "Asignar Gastos"
3. Modal: Ingresa "Transporte de materiales" $5000
4. Click "Guardar"

ESPERADO:
- PUT /api/v1/trabajos-extra/8
- itemsCalculadora[0].gastosGenerales = [{descripcion: "Transporte...", ...}]
- BD: trabajo extra actualizado
- Frontend: Muestra badge "1 gasto"
- Refresh: Datos persisten

ACTUAL:
❌ Error 400/500 (endpoint presupuesto no existe)
❌ No se guarda nada
```

### Caso 4: Gestionar Etapas (Días)
```
1. Usuario abre trabajo extra 8
2. Click en "Etapas Diarias"
3. Modal: Selecciona fechas 16-17-18-19-20 Feb
4. Click "Guardar"

ESPERADO:
- PUT /api/v1/trabajos-extra/8
- dias = ["2026-02-16", "2026-02-17", ...]
- BD: trabajo extra actualizado
- Cronograma: Calcula semanas correctamente
- Refresh: Datos persisten

ACTUAL:
❌ No se persiste en trabajo extra
❌ Se guarda en tabla relacional separada
❌ Inconsistencias de datos
```

---

## � CONTRATO DE CAMPOS (BACKEND REAL)

### 🔴 CAMPOS OBLIGATORIOS DEL ITEM

```javascript
{
  // Identificación
  tipoProfesional: string,          // "Electricista", "Albañil", etc.
  descripcion: string,              // Opcional pero recomendado
  
  // Flags CRÍTICOS (siempre requeridos)
  esModoManual: boolean,            // false para items estándar
  esRubroVacio: boolean,            // false para items con datos
  esGastoGeneral: boolean,          // false para profesionales/materiales
  incluirEnCalculoDias: boolean,    // true para calcular cronograma
  trabajaEnParalelo: boolean,       // true si no depende de otros
  
  // Cálculos financieros
  cantidadJornales: number,         // Total jornales (float)
  importeJornal: number,            // Precio unitario (float)
  subtotalManoObra: number,         // cantidadJornales × importeJornal
  total: number,                    // Total del item (float)
  
  // Arrays (pueden estar vacíos pero deben existir)
  profesionales: [],
  materialesLista: [],
  gastosGenerales: [],
  jornales: []
}
```

### 🟠 CAMPOS OBLIGATORIOS DE PROFESIONAL

```javascript
{
  // OBLIGATORIOS (5 campos)
  rol: string,                      // "Electricista Oficial", "Ayudante"
  nombreCompleto: string,           // "Juan Pérez"
  cantidadJornales: number,         // Jornales trabajados (float)
  valorJornal: number,              // Precio unitario (float)
  subtotal: number,                 // cantidadJornales × valorJornal
  
  // OPCIONALES
  profesionalObraId: number,        // ID si está en BD relacional
  incluirEnCalculoDias: boolean,    // Default: true
  observaciones: string,            // null o texto libre
  frontendId: number                // ID temporal del frontend
}
```

### 🟢 CAMPOS DE MATERIAL

```javascript
{
  nombre: string,
  unidad: string,                   // "m3", "kg", "unidad"
  cantidad: number,
  precio: number,
  subtotal: number,                 // cantidad × precio
  descripcion: string,              // Opcional
  observaciones: string             // Opcional
}
```

### 🔵 CAMPOS DE GASTO GENERAL

```javascript
{
  descripcion: string,
  cantidad: number,
  precioUnitario: number,
  subtotal: number,                 // cantidad × precioUnitario
  sinCantidad: boolean,             // Opcional
  sinPrecio: boolean,               // Opcional
  orden: number,                    // Opcional
  observaciones: string             // Opcional
}
```

---

## �📦 DATOS DE PRUEBA

```json
{
  "trabajoExtraId": 8,
  "obraId": 7,
  "empresaId": 1,
  
  "nuevoItem": {
    "tipoProfesional": "Electricista",
    "descripcion": "Instalación eléctrica adicional",
    "cantidadJornales": 3,
    "importeJornal": 15000,
    
    "profesionales": [
      {
        "nombreCompleto": "Juan Pérez",
        "rol": "Electricista Oficial",
        "cantidadJornales": 3,
        "valorJornal": 15000
      }
    ],
    
    "materiales": [
      {
        "nombre": "Cable 2.5mm",
        "unidad": "metros",
        "cantidad": 50,
        "precio": 250
      }
    ],
    
    "gastos": [
      {
        "descripcion": "Transporte",
        "cantidad": 1,
        "precioUnitario": 3500
      }
    ]
  },
  
  "dias": [
    "2026-02-16",
    "2026-02-17",
    "2026-02-18"
  ]
}
```

---

## ✅ CHECKLIST PARA BACKEND

Backend debe confirmar:

- [ ] `GET /api/v1/trabajos-extra/{id}` devuelve `itemsCalculadora` completo con profesionales/materiales/gastos
- [ ] `PUT /api/v1/trabajos-extra/{id}` actualiza correctamente `itemsCalculadora`
- [ ] Los datos en `itemsCalculadora` se persisten en BD
- [ ] Al refrescar, `itemsCalculadora` tiene los datos guardados
- [ ] Los cambios NO crean duplicados en tablas relacionales
- [ ] Totales se recalculan correctamente
- [ ] `dias[]` se guarda y persiste correctamente
- [ ] Validaciones de datos funcionan
- [ ] No hay conflictos entre datos guardados en diferentes tablas

---

## 🚀 PLAN DE ACCIÓN

### Fase 1: Validación Backend ✅ COMPLETADA
1. ✅ Backend confirma que PUT actualiza `itemsCalculadora` correctamente
2. ✅ Persistencia en BD verificada
3. ✅ Independencia de tablas relacionales confirmada
4. ✅ Campos obligatorios identificados

### Fase 2: Frontend Implementation (EN CURSO)
1. ✅ Modales detectan trabajo extra (`obra._esTrabajoExtra`)
2. ✅ Bloqueo temporal implementado para evitar guardados incorrectos
3. 🔄 **PENDIENTE:** Implementar guardado correcto con PUT a `/api/v1/trabajos-extra/{id}`
4. 🔄 **PENDIENTE:** Construir payload con todos los campos obligatorios
5. 🔄 **PENDIENTE:** Actualizar badges y UI después del guardado

### Fase 3: Testing y Validación
1. Probar asignación de profesionales
2. Probar asignación de materiales
3. Probar asignación de gastos generales
4. Verificar persistencia después de refresh
5. Validar cálculos de totales

---

## ✅ VALIDACIÓN CON BACKEND

**Respuestas confirmadas:**
1. ✅ Backend está listo para persistir en `itemsCalculadora`
2. ✅ PUT `/api/v1/trabajos-extra/{id}` funciona correctamente
3. ✅ Campos obligatorios identificados y documentados
4. ✅ No se requieren cambios en backend
5. ✅ Independiente de tablas relacionales

---

## 🎯 PRÓXIMOS PASOS PARA FRONTEND

1. **Implementar lógica de guardado en modales:**
   - `AsignarProfesionalSemanalModal.jsx`
   - `AsignarMaterialObraModal.jsx`
   - `AsignarOtroCostoObraModal.jsx`

2. **Construir payload correcto:**
   - Incluir TODOS los campos obligatorios del item
   - Mapear profesionales seleccionados al formato correcto
   - Calcular subtotales correctamente

3. **Llamar al endpoint correcto:**
   - `PUT /api/v1/trabajos-extra/{id}?empresaId={empresaId}`
   - Con trabajo extra completo actualizado

4. **Actualizar UI:**
   - Refrescar badges
   - Mostrar profesionales asignados
   - Feedback visual de éxito

---

## 💻 EJEMPLO DE IMPLEMENTACIÓN FRONTEND

### Función helper para construir payload

```javascript
/**
 * Construye el payload completo para actualizar un trabajo extra
 * @param {Object} trabajoExtra - Trabajo extra actual
 * @param {Array} profesionalesSeleccionados - Profesionales a asignar
 * @param {Array} materialesSeleccionados - Materiales a asignar
 * @param {Array} gastosSeleccionados - Gastos a asignar
 * @returns {Object} Payload completo para PUT
 */
function construirPayloadTrabajoExtra(
  trabajoExtra,
  profesionalesSeleccionados = [],
  materialesSeleccionados = [],
  gastosSeleccionados = []
) {
  const items = [];
  
  // Agrupar profesionales por tipoProfesional
  const profesionalesPorTipo = {};
  profesionalesSeleccionados.forEach(prof => {
    const tipo = prof.tipoProfesional || prof.rol || 'Profesional';
    if (!profesionalesPorTipo[tipo]) {
      profesionalesPorTipo[tipo] = [];
    }
    profesionalesPorTipo[tipo].push(prof);
  });
  
  // Crear items por cada tipo de profesional
  Object.entries(profesionalesPorTipo).forEach(([tipo, profs]) => {
    const totalJornales = profs.reduce((sum, p) => sum + (p.cantidadJornales || 0), 0);
    const importePromedio = profs.length > 0 
      ? profs.reduce((sum, p) => sum + (p.valorJornal || 0), 0) / profs.length 
      : 0;
    const subtotal = profs.reduce((sum, p) => sum + (p.subtotal || 0), 0);
    
    items.push({
      tipoProfesional: tipo,
      descripcion: `${tipo} - ${profs.length} profesional(es)`,
      
      // ⚠️ CAMPOS OBLIGATORIOS
      esModoManual: false,
      esRubroVacio: false,
      esGastoGeneral: false,
      incluirEnCalculoDias: true,
      trabajaEnParalelo: true,
      
      cantidadJornales: totalJornales,
      importeJornal: importePromedio,
      subtotalManoObra: subtotal,
      total: subtotal,
      
      profesionales: profs.map(p => ({
        // Campos obligatorios
        rol: p.rol || tipo,
        nombreCompleto: p.nombreCompleto || p.nombre,
        cantidadJornales: Number(p.cantidadJornales || 0),
        valorJornal: Number(p.valorJornal || 0),
        subtotal: Number(p.subtotal || 0),
        
        // Campos opcionales
        profesionalObraId: p.id || p.profesionalObraId,
        incluirEnCalculoDias: p.incluirEnCalculoDias !== false,
        observaciones: p.observaciones || null
      })),
      
      materialesLista: [],
      gastosGenerales: [],
      jornales: []
    });
  });
  
  // Agregar materiales (si los hay)
  if (materialesSeleccionados.length > 0) {
    // Aquí puedes agregar lógica similar para materiales
  }
  
  // Agregar gastos (si los hay)
  if (gastosSeleccionados.length > 0) {
    // Aquí puedes agregar lógica similar para gastos
  }
  
  return {
    obraId: trabajoExtra.obraId,
    nombre: trabajoExtra.nombre,
    descripcion: trabajoExtra.descripcion,
    fechaProbableInicio: trabajoExtra.fechaProbableInicio,
    vencimiento: trabajoExtra.vencimiento,
    tiempoEstimadoTerminacion: trabajoExtra.tiempoEstimadoTerminacion,
    itemsCalculadora: items,
    dias: trabajoExtra.dias || []
  };
}
```

### Ejemplo de uso en modal

```javascript
// En handleAsignar de AsignarProfesionalSemanalModal.jsx
const handleAsignar = async () => {
  if (obra._esTrabajoExtra) {
    try {
      setCargando(true);
      
      // 1. Obtener trabajo extra actual completo
      const trabajoExtra = await api.trabajosExtra.getById(
        obra.id, 
        empresaSeleccionada.id
      );
      
      // 2. Construir payload con profesionales seleccionados
      const payload = construirPayloadTrabajoExtra(
        trabajoExtra,
        profesionalesSeleccionados
      );
      
      // 3. Enviar PUT al backend
      const response = await axios.put(
        `/api/v1/trabajos-extra/${obra.id}?empresaId=${empresaSeleccionada.id}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 4. Success feedback
      alert('✅ Profesionales asignados correctamente al trabajo extra');
      
      // 5. Actualizar UI
      if (onAsignar) onAsignar();
      if (onRefreshProfesionales) onRefreshProfesionales();
      
      onHide();
    } catch (error) {
      console.error('Error asignando profesionales a trabajo extra:', error);
      alert('❌ Error al guardar: ' + error.message);
    } finally {
      setCargando(false);
    }
    
    return; // No continuar con lógica de obras normales
  }
  
  // ... lógica normal para obras...
};
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN FRONTEND

### Paso 1: Detección de Trabajo Extra ✅ HECHO
- [x] Modal detecta `obra._esTrabajoExtra`
- [x] Bloqueo temporal implementado
- [x] Alert muestra mensaje correcto
- [x] No se ejecutan llamadas a APIs incorrectas

### Paso 2: Construcción de Payload ❌ PENDIENTE
- [ ] Crear función `construirPayloadTrabajoExtra()`
- [ ] Mapear profesionales seleccionados al formato correcto
- [ ] Incluir TODOS los campos obligatorios:
  - [ ] `esModoManual: false`
  - [ ] `esRubroVacio: false`
  - [ ] `esGastoGeneral: false`
  - [ ] `incluirEnCalculoDias: true`
  - [ ] `trabajaEnParalelo: true`
- [ ] Calcular `subtotalManoObra` correctamente
- [ ] Calcular `total` del item
- [ ] Incluir arrays vacíos: `materialesLista`, `gastosGenerales`, `jornales`

### Paso 3: Llamada al Backend ❌ PENDIENTE
- [ ] Usar `PUT` (no POST)
- [ ] Endpoint: `/api/v1/trabajos-extra/{id}?empresaId={empresaId}`
- [ ] Headers: `Content-Type: application/json`
- [ ] Enviar trabajo extra completo (no solo diff)
- [ ] Manejar errores correctamente

### Paso 4: Actualización UI ❌ PENDIENTE
- [ ] Llamar `onAsignar()` después del éxito
- [ ] Llamar `onRefreshProfesionales()` para actualizar badges
- [ ] Mostrar mensaje de éxito
- [ ] Cerrar modal (`onHide()`)
- [ ] Actualizar contadores/badges en lista de obras

### Paso 5: Testing ❌ PENDIENTE
- [ ] Probar asignación de 1 profesional
- [ ] Probar asignación de múltiples profesionales
- [ ] Probar asignación de diferentes tipos (Electricista + Albañil)
- [ ] Verificar persistencia después de refresh
- [ ] Verificar que badges muestren cantidad correcta
- [ ] Probar eliminación (enviar payload vacío)

---

## ⚠️ VALIDACIONES REQUERIDAS

### Antes de enviar al backend:

```javascript
function validarPayloadTrabajoExtra(payload) {
  const errores = [];
  
  // Validar estructura base
  if (!payload.obraId) {
    errores.push('obraId es obligatorio');
  }
  
  if (!payload.nombre) {
    errores.push('nombre es obligatorio');
  }
  
  if (!Array.isArray(payload.itemsCalculadora)) {
    errores.push('itemsCalculadora debe ser un array');
    return errores;
  }
  
  // Validar cada item
  payload.itemsCalculadora.forEach((item, index) => {
    // Campos obligatorios del item
    const camposObligatorios = [
      'tipoProfesional',
      'esModoManual',
      'esRubroVacio',
      'esGastoGeneral',
      'cantidadJornales',
      'importeJornal',
      'subtotalManoObra',
      'total',
      'trabajaEnParalelo'
    ];
    
    camposObligatorios.forEach(campo => {
      if (item[campo] === undefined || item[campo] === null) {
        errores.push(`Item ${index}: ${campo} es obligatorio`);
      }
    });
    
    // Validar arrays
    if (!Array.isArray(item.profesionales)) {
      errores.push(`Item ${index}: profesionales debe ser un array`);
    }
    
    if (!Array.isArray(item.materialesLista)) {
      errores.push(`Item ${index}: materialesLista debe ser un array`);
    }
    
    if (!Array.isArray(item.gastosGenerales)) {
      errores.push(`Item ${index}: gastosGenerales debe ser un array`);
    }
    
    // Validar profesionales
    item.profesionales?.forEach((prof, profIndex) => {
      const camposObligatoriosProf = [
        'rol',
        'nombreCompleto',
        'cantidadJornales',
        'valorJornal',
        'subtotal'
      ];
      
      camposObligatoriosProf.forEach(campo => {
        if (!prof[campo]) {
          errores.push(`Item ${index}, Profesional ${profIndex}: ${campo} es obligatorio`);
        }
      });
      
      // Validar cálculo de subtotal
      const subtotalCalculado = prof.cantidadJornales * prof.valorJornal;
      if (Math.abs(prof.subtotal - subtotalCalculado) > 0.01) {
        errores.push(`Item ${index}, Profesional ${profIndex}: subtotal incorrecto (esperado: ${subtotalCalculado}, recibido: ${prof.subtotal})`);
      }
    });
  });
  
  return errores;
}

// Uso antes de enviar
const errores = validarPayloadTrabajoExtra(payload);
if (errores.length > 0) {
  console.error('❌ Payload inválido:', errores);
  alert('Error: Datos incompletos\n' + errores.join('\n'));
  return;
}
```

---

**Documento preparado por:** Frontend Team  
**Fecha:** 09/02/2026  
**Versión:** 2.0  
**Estado:** ✅ Validado con backend - Listo para implementación
**Requisito:** CRÍTICO para funcionalidad de Trabajos Extra

---

## 📝 RESUMEN EJECUTIVO - ESTADO ACTUAL

### ✅ Lo que funciona:
- Backend listo para recibir `itemsCalculadora` completo
- Endpoint `PUT /api/v1/trabajos-extra/{id}` funcional
- Persistencia en BD confirmada
- Campos obligatorios identificados y documentados
- Frontend detecta trabajos extra correctamente
- Bloqueo temporal implementado para evitar guardados incorrectos

### ❌ Lo que NO funciona aún:
- Asignación de profesionales a trabajos extra
- Asignación de materiales a trabajos extra
- Asignación de gastos generales a trabajos extra
- Gestión de etapas (días) para trabajos extra
- Actualización de badges después de asignaciones

### 🔧 Trabajo pendiente:
1. **Implementar construcción de payload** (1-2 horas)
   - Función helper `construirPayloadTrabajoExtra()`
   - Mapeo de profesionales/materiales/gastos
   - Validaciones de campos obligatorios

2. **Modificar modales** (2-3 horas)
   - AsignarProfesionalSemanalModal.jsx
   - AsignarMaterialObraModal.jsx
   - AsignarOtroCostoObraModal.jsx
   - Agregar lógica de guardado con PUT

3. **Testing y validación** (1 hora)
   - Pruebas de asignación
   - Verificar persistencia
   - Validar cálculos de totales

**Tiempo estimado total:** 4-6 horas de desarrollo

---

## 🚨 NOTAS IMPORTANTES PARA DEVELOPERS

1. **NO usar endpoints de presupuestos-no-cliente para trabajos extra**
   - ❌ `/api/presupuestos-no-cliente/{id}/gastos-generales`
   - ❌ `/api/presupuestos-no-cliente/{id}/materiales`
   - ✅ Usar: `/api/v1/trabajos-extra/{id}` para TODO

2. **NO usar endpoints relacionales para trabajos extra**
   - ❌ `POST /api/profesionales/asignar-semanal`
   - ❌ `POST /api/materiales/asignar`
   - ❌ `POST /api/gastos/asignar`
   - ✅ Usar: `PUT /api/v1/trabajos-extra/{id}` con payload completo

3. **SIEMPRE incluir campos obligatorios del item:**
   ```javascript
   {
     esModoManual: false,
     esRubroVacio: false,
     esGastoGeneral: false,
     incluirEnCalculoDias: true,
     trabajaEnParalelo: true,
     // ... otros campos
   }
   ```

4. **PUT reemplaza TODO el itemsCalculadora:**
   - No es PATCH (parcial)
   - Debes enviar el array completo
   - Backend hace delete old + insert new

5. **Arrays vacíos son válidos:**
   ```javascript
   {
     profesionales: [],
     materialesLista: [],
     gastosGenerales: [],
     jornales: []
   }
   ```

--
