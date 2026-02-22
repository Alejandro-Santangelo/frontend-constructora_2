# 🔍 DIAGNÓSTICO: Inconsistencia entre Modales de Cobros

## **Problema Reportado**
El usuario observa que hay una **inconsistencia** entre dos modales:

1. **Modal "Asignar Saldo Disponible a Obras"** (`AsignarCobroDisponibleModal.jsx`)
   - Muestra cobro del 10/2/2026: $10.000.000,00
   - **Asignado**: $500.000,00
   - **Disponible**: $9.500.000,00

2. **Modal "Desglose de Saldo Disponible"** (`DetalleConsolidadoPorObraModal.jsx`) 
   - **Total Asignado a Obras**: $20.000.000,00
   - En el desglose, solo muestra "Casa de Cacho" con $20.000.000,00
   - **NO aparecen los $500.000 asignados** en ninguna obra

---

## **Causa Raíz Identificada**

### 📊 **Arquitectura del Sistema**

El sistema maneja **5 tipos de entidades financieras**:

1. **OBRA_PRINCIPAL** - Obras con presupuesto aprobado/en ejecución
2. **TRABAJO_EXTRA** - Trabajos adicionales sobre obra existente
3. **TRABAJO_ADICIONAL** - Tareas leves/mantenimiento
4. **OBRA_INDEPENDIENTE** - Obras sin presupuesto (trabajo diario)
5. **NO_CLIENTE** - Presupuestos no cliente (relacionado a empresas)

### 🔗 **Sistema de Asignaciones**

Las asignaciones de cobros (`asignaciones_cobro_obra`) pueden tener:
```javascript
{
  cobroEmpresaId: 123,
  montoAsignado: 500000,
  
  // Identificadores de entidad destino (uno de estos):
  obraId: ...,                  // OBRA_PRINCIPAL
  presupuestoNoClienteId: ...,  // Presupuesto
  trabajoAdicionalId: ...,      // TRABAJO_ADICIONAL ✅
  trabajoExtraId: ...,          // TRABAJO_EXTRA
  obraIndependienteId: ...,     // OBRA_INDEPENDIENTE ✅
}
```

### ❌ **El Problema**

**En `useEstadisticasConsolidadas.js` (línea 557-717):**

El array `desglosePorObra` se construye **SOLO** iterando sobre `presupuestosUnicos`:

```javascript
for (const presupuesto of presupuestosUnicos) {
  // Solo incluye: OBRA_PRINCIPAL con presupuestos aprobados/en ejecución
  
  const asignacionesObra = todasLasAsignaciones.filter(a =>
    (a.obraId === presupuesto.obraId || 
     a.presupuestoNoClienteId === presupuesto.id)
  );
  
  desglosePorObra.push({ 
    nombreObra: ...,
    totalCobrado: suma de asignacionesObra
  });
}
```

**Lo que FALTA:**
- ❌ No incluye asignaciones donde `trabajoAdicionalId !== null` (Tareas Leves)
- ❌ No incluye asignaciones donde `obraIndependienteId !== null` (Obras Independientes)

Por eso, si hay $500.000 asignados a un Trabajo Adicional o una Obra Independiente:
- ✅ Aparece en el **primer modal** (porque el backend cuenta TODAS las asignaciones)
- ❌ NO aparece en el **segundo modal** (porque `desglosePorObra` no incluye TAs ni OIs)

---

## **Escenario Probable**

Los $500.000 están asignados a:
- **Un Trabajo Adicional** (Tarea Leve como reubicación de ventanas, instalación de aire, etc.)
- **O una Obra Independiente** (trabajo diario sin presupuesto)

Estas entidades:
1. ✅ Tienen una asignación válida de cobro en la BD
2. ✅ El backend cuenta esa asignación en el `montoAsignado` del cobro
3. ❌ NO están en array `presupuestosUnicos` porque no tienen estado APROBADO/EN_EJECUCION
4. ❌ NO se agregan a `desglosePorObra`
5. ❌ NO aparecen en el modal de desglose

---

## **Impacto**

### 🔴 **Crítico**
- **Inconsistencia contable**: La suma del desglose NO coincide con el total asignado reportado por el backend
- **Falta de visibilidad**: El usuario no puede ver dónde están asignados esos $500.000
- **Decisiones incorrectas**: El dashboard muestra datos parciales

### 📊 **Datos Afectados**
```
Backend (cobrosEmpresa):
  Cobro 10/2/2026: $10.000.000
    - Asignado: $500.000 ✅ (a un TA o OI)
    - Disponible: $9.500.000
  
Frontend (DetalleConsolidadoPorObraModal):
  Total Asignado: $20.000.000
    - Casa de Cacho: $20.000.000
    - [FALTA: entidad con $500.000] ❌
```

---

## **Solución Propuesta**

### 🎯 **Objetivo**
Incluir TAs y OIs con asignaciones de cobro en el array `desglosePorObra`

### 📝 **Pasos**

**1. En `useEstadisticasConsolidadas.js` (después de línea 717):**

```javascript
// ✅ AGREGAR asignaciones a Trabajos Adicionales
const asignacionesTA = todasLasAsignaciones.filter(a => 
  a.trabajoAdicionalId && 
  (a.estado === 'ACTIVA' || a.estado === 'activa')
);

// Agrupar por trabajoAdicionalId
const taConAsignaciones = new Map();
asignacionesTA.forEach(asig => {
  const taId = asig.trabajoAdicionalId;
  if (!taConAsignaciones.has(taId)) {
    taConAsignaciones.set(taId, {
      asignaciones: [],
      totalAsignado: 0
    });
  }
  const ta = taConAsignaciones.get(taId);
  ta.asignaciones.push(asig);
  ta.totalAsignado += parseFloat(asig.montoAsignado || 0);
});

// Cargar datos completos de cada TA y agregar a desglosePorObra
for (const [taId, data] of taConAsignaciones.entries()) {
  try {
    const ta = await trabajosAdicionalesService.obtenerTrabajoPorId(taId, empresaId);
    desglosePorObra.push({
      id: ta.id,
      obraId: ta.obraId || null,
      nombreObra: ta.nombre || ta.descripcion || `Tarea Adicional #${ta.id}`,
      numeroPresupuesto: null,
      estado: 'APROBADO',
      totalPresupuesto: ta.importe || 0,
      totalCobrado: data.totalAsignado,
      cantidadCobros: data.asignaciones.length,
      esTrabajoAdicional: true, // ✅ Flag identificador
      tipoEntidad: 'TRABAJO_ADICIONAL'
    });
  } catch (err) {
    console.warn(`⚠️ Error cargando TA ${taId}:`, err);
  }
}

// ✅ AGREGAR asignaciones a Obras Independientes
const asignacionesOI = todasLasAsignaciones.filter(a => 
  a.obraIndependienteId && 
  (a.estado === 'ACTIVA' || a.estado === 'activa')
);

// Agrupar por obraIndependienteId
const oiConAsignaciones = new Map();
asignacionesOI.forEach(asig => {
  const oiId = asig.obraIndependienteId;
  if (!oiConAsignaciones.has(oiId)) {
    oiConAsignaciones.set(oiId, {
      asignaciones: [],
      totalAsignado: 0
    });
  }
  const oi = oiConAsignaciones.get(oiId);
  oi.asignaciones.push(asig);
  oi.totalAsignado += parseFloat(asig.montoAsignado || 0);
});

// Cargar datos completos de cada OI y agregar a desglosePorObra
for (const [oiId, data] of oiConAsignaciones.entries()) {
  try {
    const oi = await api.obras.getById(oiId, empresaId);
    desglosePorObra.push({
      id: oi.id,
      obraId: oi.id,
      nombreObra: oi.nombre || `${oi.direccionObraCalle} ${oi.direccionObraAltura}`,
      numeroPresupuesto: null,
      estado: oi.estado || 'APROBADO',
      totalPresupuesto: oi.presupuestoEstimado || 0,
      totalCobrado: data.totalAsignado,
      cantidadCobros: data.asignaciones.length,
      esObraIndependiente: true, // ✅ Flag identificador
      tipoEntidad: 'OBRA_INDEPENDIENTE'
    });
  } catch (err) {
    console.warn(`⚠️ Error cargando OI ${oiId}:`, err);
  }
}
```

**2. En `DetalleConsolidadoPorObraModal.jsx` - función `renderSaldoDisponible`:**

Actualizar el render para identificar visualmente TAs y OIs:

```javascript
{obra.esTrabajoAdicional && (
  <span className="badge ms-1" style={{backgroundColor: '#fd7e14', color: '#fff'}}>
    🔧 Tarea Leve
  </span>
)}
{obra.esObraIndependiente && (
  <span className="badge bg-info ms-1">Independiente</span>
)}
```

---

## **Verificación**

### ✅ **Después de aplicar la solución:**

1. Revisar logs en consola para identificar la entidad con $500.000:
```
✅ Asignaciones a Trabajos Adicionales: X
✅ Asignaciones a Obras Independientes: Y
```

2. El modal "Desglose de Saldo Disponible" debe mostrar:
```
Casa de Cacho:          $20.000.000,00
[Nombre de TA/OI]:      $500.000,00
─────────────────────────────────────
TOTAL ASIGNADO:         $20.500.000,00
```

3. Ambos modales deben coincidir:
```
Modal 1 (Asignar Saldo):  Total Asignado = $20.500.000
Modal 2 (Desglose):       Total Asignado = $20.500.000 ✅
```

---

## **Archivos a Modificar**

1. ✅ `src/hooks/useEstadisticasConsolidadas.js` (línea ~750)
2. ✅ `src/components/DetalleConsolidadoPorObraModal.jsx` (función `renderSaldoDisponible`)

---

## **Riesgo**
⚠️ **MEDIO** - Cambios en lógica de estadísticas consolidadas requieren pruebas exhaustivas

## **Tiempo Estimado**
⏱️ 30-45 minutos

---

**Generado**: 22/02/2026  
**Estado**: Diagnóstico completo - Listo para implementar
