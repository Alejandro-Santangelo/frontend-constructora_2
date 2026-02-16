# Diagnóstico: Presupuesto No Cliente no aparece en la lista

## Problema reportado
- Se creó un nuevo presupuesto no cliente
- En la BD se mapeó correctamente
- La lista en la página no lo muestra

## Cambios realizados

### 1. Agregados logs de diagnóstico en `PresupuestosNoClientePage.jsx`

Se agregaron logs en el método `loadList()` para rastrear:
- Datos recibidos del backend
- Cantidad de presupuestos tras cada paso de procesamiento
- Filtros activos aplicados
- Resultados finales

### 2. Para diagnosticar el problema

**Abra la consola del navegador (F12) y busque estos mensajes:**

```
🔍 [DIAGNÓSTICO] Datos recibidos del backend:
🔍 [DIAGNÓSTICO] Lista procesada (total):
🔍 [DIAGNÓSTICO] Presupuestos agrupados por número:
🔍 [DIAGNÓSTICO] Después de filtrar a última versión:
🔍 [DIAGNÓSTICO] Filtros activos:
🔍 [DIAGNÓSTICO] Antes de filtros:
🔍 [DIAGNÓSTICO] Después de filtros:
```

### 3. Posibles causas del problema

#### Causa 1: Filtros guardados en localStorage
**Síntoma:** El presupuesto existe pero los filtros lo ocultan
**Verificar:** 
- En la consola, ver si "Filtros activos:" muestra filtros aplicados
- Ver si "Antes de filtros" > "Después de filtros" (se perdieron presupuestos)

**Solución:**
1. En la página, buscar el botón para limpiar filtros por defecto
2. O ejecutar en la consola del navegador:
```javascript
localStorage.removeItem('presupuestos_filtros_por_defecto');
location.reload();
```

#### Causa 2: Problema con numeroPresupuesto o numeroVersion
**Síntoma:** El presupuesto no aparece en "Datos recibidos del backend"
**Verificar:**
- El presupuesto tiene un `numeroPresupuesto` válido
- El presupuesto tiene un `numeroVersion` válido
- Si hay múltiples versiones, se está mostrando la más reciente

**Solución:**
- Verificar en la BD que el presupuesto tenga ambos campos poblados
```sql
SELECT id, numero_presupuesto, numero_version, nombre_obra, estado 
FROM presupuesto_no_cliente 
ORDER BY id DESC LIMIT 10;
```

#### Causa 3: Filtro de empresaId incorrecto
**Síntoma:** El presupuesto no aparece en "Datos recibidos del backend"
**Verificar:**
- El presupuesto fue creado con la empresaId correcta
- La empresa seleccionada en el frontend es la correcta

**Solución:**
- Verificar en la BD:
```sql
SELECT id, numero_presupuesto, nombre_obra, empresa_id 
FROM presupuesto_no_cliente 
WHERE id = [ID_DEL_PRESUPUESTO_CREADO];
```
- Comparar con la empresa seleccionada en el frontend (ver consola)

#### Causa 4: Problema con agrupación por versiones
**Síntoma:** Aparece en "Datos recibidos" pero no en "Después de filtrar a última versión"
**Verificar:**
- Si existe otra versión más reciente del mismo número de presupuesto

**Solución:**
- Temporalmente comentar el filtrado de versiones para ver todos

### 4. Comando de diagnóstico rápido

**Ejecutar en la consola del navegador:**

```javascript
// Ver presupuestos guardados en el estado del componente
// (después de que la página haya cargado)
console.log('Presupuestos en memoria:', window.__presupuestosDebug);

// Limpiar filtros
localStorage.removeItem('presupuestos_filtros_por_defecto');

// Recargar
location.reload();
```

### 5. Si el problema persiste

**Verificar directamente el endpoint del backend:**

Abrir en una nueva pestaña (reemplazar {empresaId} con el valor correcto):
```
http://localhost:8080/api/v1/presupuestos-no-cliente?empresaId={empresaId}
```

Buscar en la respuesta JSON el presupuesto creado por su ID, número o nombre.

Si NO aparece aquí, el problema está en el backend (filtro de Hibernate o query).
Si SÍ aparece aquí, el problema está en el frontend (filtrado o agrupación).

## Próximos pasos

1. **Revisar los logs en la consola** para identificar en qué paso se pierde el presupuesto
2. **Verificar filtros** guardados en localStorage
3. **Verificar datos en la BD** (numeroPresupuesto, numeroVersion, empresaId)
4. **Llamar directamente al endpoint** para verificar que el backend lo devuelva
