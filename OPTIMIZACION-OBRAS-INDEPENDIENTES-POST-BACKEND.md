# OPTIMIZACIÓN FRONTEND - OBRAS INDEPENDIENTES
## Cambios a realizar DESPUÉS de actualizar el backend

**Fecha:** 15 de Febrero 2026  
**Estado Backend:** ⏳ Pendiente ejecutar migración V40 y reiniciar

---

## RESUMEN EJECUTIVO

El backend ya tiene implementado el campo `esObraManual` (boolean) en todas las respuestas de obras.
Una vez que el backend esté actualizado (migración V40 ejecutada + restart), podemos simplificar
significativamente la lógica del frontend para identificar obras independientes.

---

## ✅ CAMBIOS YA REALIZADOS EN FRONTEND

### 1. API Service actualizado (`src/services/api.js`)
```javascript
// Nuevo método agregado:
getObrasManuales: (empresaId) => 
  apiService.get(`/api/obras/empresa/${empresaId}`, { empresaId, soloManuales: true })

// Método getPorEmpresa ahora soporta filtro opcional:
getPorEmpresa: (empresaId, soloManuales = false) => {
  const params = { empresaId };
  if (soloManuales) params.soloManuales = true;
  return apiService.get(`/api/obras/empresa/${empresaId}`, params);
}
```

---

## ⏳ OPTIMIZACIONES PENDIENTES (Post-Backend Update)

### 1. Simplificar filtrado en Dashboard

**Archivo:** `src/pages/FunctionalDashboard.jsx`  
**Líneas:** 196-218

**ACTUAL (Lógica compleja - 23 líneas):**
```javascript
// Crear Set de IDs de obras que tienen presupuesto
const obrasConPresupuesto = new Set();
presupuestosArray.forEach(p => {
  if (p.obraId) obrasConPresupuesto.add(p.obraId);
});

// Contar obras que NO tienen presupuesto y NO están canceladas
trabajosIndependientesCount = obrasArray.filter(obra =>
  !obrasConPresupuesto.has(obra.id) &&
  !obra.presupuestoNoCliente &&
  obra.estado !== 'CANCELADO'
).length;
```

**OPTIMIZADO (Simple - 3 líneas):**
```javascript
// Usar campo esObraManual del backend
trabajosIndependientesCount = obrasArray.filter(obra =>
  obra.esObraManual && obra.estado !== 'CANCELADO'
).length;
```

**Beneficio:** -20 líneas de código, más legible, más eficiente, elimina dependencia de presupuestosArray

---

### 2. Simplificar tab Obras Independientes

**Archivo:** `src/pages/ObrasPage.jsx`  
**Líneas:** 5838-5842, 5856-5860

**ACTUAL (Lógica compleja):**
```javascript
const obrasManuales = obras.filter(obra => {
  const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                          (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
  return !tienePresupuesto && obra.estado !== 'CANCELADO';
});
```

**OPTIMIZADO (Simple):**
```javascript
const obrasManuales = obras.filter(obra => 
  obra.esObraManual && obra.estado !== 'CANCELADO'
);
```

**Beneficio:** Más legible, elimina dependencia de presupuestosObras

---

### 3. Simplificar contador en botón header

**Archivo:** `src/pages/ObrasPage.jsx`  
**Líneas:** 4275-4280

**ACTUAL:**
```javascript
Obras Independientes ({obras.filter(obra => {
  const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                          (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
  return !tienePresupuesto && obra.estado !== 'CANCELADO';
}).length})
```

**OPTIMIZADO:**
```javascript
Obras Independientes ({obras.filter(obra => 
  obra.esObraManual && obra.estado !== 'CANCELADO'
).length})
```

---

### 4. Simplificar contador en sidebar

**Archivo:** `src/components/SidebarNew.jsx`  
**Lugar:** Cálculo de `conteoObrasManuales`

**ACTUAL:** (Se calcula igual que arriba, lógica compleja)

**OPTIMIZADO:**
```javascript
const conteoObrasManuales = obras.filter(obra => 
  obra.esObraManual && obra.estado !== 'CANCELADO'
).length;
```

---

### 5. Actualizar badge en tabla de obras

**Archivo:** `src/pages/ObrasPage.jsx`  
**Línea:** ~5916 (en tabla de obras independientes)

**Verificar que use:**
```javascript
{obra.esObraManual && (
  <span className="badge bg-warning text-dark ms-2">
    <i className="fas fa-hand-paper me-1"></i>Obra Independiente
  </span>
)}
```

---

## CHECKLIST DE MIGRACIÓN

### Paso 1: Verificar que backend esté actualizado
```bash
# Ejecutar migración SQL V40
psql -d construccion_app_v3 -f V40__agregar_es_obra_manual.sql

# Reiniciar backend
cd backend
./mvnw spring-boot:run
```

### Paso 2: Verificar que esObraManual llegue en respuestas
```javascript
// Abrir DevTools Console, ir a /obras y ejecutar:
const obras = await api.obras.getPorEmpresa(1);
console.log(obras[0]); // Debe tener esObraManual: true/false
```

### Paso 3: Aplicar optimizaciones en este orden
- [ ] 1. Dashboard (FunctionalDashboard.jsx líneas 196-218)
- [ ] 2. Tab obras independientes (ObrasPage.jsx líneas 5856-5860)
- [ ] 3. Contador botón header (ObrasPage.jsx línea 4275)
- [ ] 4. Badge contador (ObrasPage.jsx línea 5838)
- [ ] 5. Sidebar contador (SidebarNew.jsx)

### Paso 4: Testing
- [ ] Dashboard muestra conteo correcto
- [ ] Tab obras independientes filtra correctamente
- [ ] Botones muestran contadores correctos
- [ ] Badge "Obra Independiente" aparece solo en obras con esObraManual=true

---

## USO OPCIONAL DEL ENDPOINT DE FILTRADO

Una vez que el backend esté actualizado, puedes optar por:

### Opción A: Filtrar en frontend (ACTUAL)
```javascript
// Cargar todas las obras
const obras = await api.obras.getPorEmpresa(empresaId);
// Filtrar en JS
const obrasManuales = obras.filter(o => o.esObraManual);
```

**Ventajas:** 
- Menos requests HTTP
- Todas las obras ya cargadas en memoria

**Desventajas:**
- Transfiere más datos si hay muchas obras normales

---

### Opción B: Usar endpoint de filtrado backend (NUEVO)
```javascript
// Cargar SOLO obras independientes desde backend
const obrasManuales = await api.obras.getObrasManuales(empresaId);
```

**Ventajas:**
- Menos transferencia de datos
- Backend hace el filtrado (más eficiente)

**Desventajas:**
- Request adicional si ya tienes todas las obras cargadas

---

## RECOMENDACIÓN

**Para el tab de Obras Independientes:**
- **Usar Opción A** (filtrar en frontend) si ya tienes todas las obras cargadas
- Motivo: Es más rápido reutilizar datos ya en memoria que hacer nuevo HTTP request

**Para reportes o consultas puntuales:**
- **Usar Opción B** (endpoint filtrado) cuando SOLO necesites obras independientes
- Motivo: Más eficiente si no necesitas las demás obras

---

## IMPACTO ESTIMADO DE OPTIMIZACIÓN

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Líneas de código lógica filtrado | ~50 | ~15 | -70% |
| Dependencias de presupuestos | Sí | No | Desacoplamiento |
| Legibilidad código | Media | Alta | ↑ |
| Performance | Buena | Muy buena | ↑ |
| Mantenibilidad | Media | Alta | ↑ |

---

## BACKWARD COMPATIBILITY

Si quieres que el frontend funcione TANTO con backend antiguo como actualizado:

```javascript
// Función helper adaptativa
const esObraIndependiente = (obra, presupuestosObras = {}) => {
  // Si el backend tiene el campo esObraManual, usarlo
  if (typeof obra.esObraManual === 'boolean') {
    return obra.esObraManual;
  }
  
  // Fallback para backend antiguo (lógica compleja)
  const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                          (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
  return !tienePresupuesto;
};

// Uso:
const obrasManuales = obras.filter(obra => 
  esObraIndependiente(obra, presupuestosObras) && 
  obra.estado !== 'CANCELADO'
);
```

---

## CONTACTO / REFERENCIAS

- **Informe Backend:** INFORME-BACKEND-OBRAS-MANUALES.md
- **Migración SQL:** V40__agregar_es_obra_manual.sql
- **Endpoint Backend:** `GET /api/obras/empresa/{id}?soloManuales=true`
- **Campo Response:** `esObraManual: boolean`

---

**Última actualización:** 15 de Febrero 2026  
**Estado:** ✅ Documentado - ⏳ Pendiente aplicar cambios post-backend-update
