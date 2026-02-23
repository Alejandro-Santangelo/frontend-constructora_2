# 🐛 INSTRUCCIONES PARA DIAGNOSTICAR BUG MULTIPLICACIÓN 2.4x

## PROBLEMA IDENTIFICADO
El frontend está mostrando valores multiplicados aproximadamente por 2.4x:
- **Backend/DB correcto**: $16,500,000.00  
- **Frontend mostrado**: ~$48,000,000.00 (sin descuentos) / ~$37,500,000.00 (con descuentos)

## ACCIONES PARA DIAGNÓSTICO

### 1. Abrir la Consola del Navegador
Presiona **F 12** → pestaña **Console**

### 2. Cargar el Presupuesto ID 70
1. Ve a la página "Presupuestos No Cliente"
2. Haz clic en "Recargar sin Caché" (botón verde)
3. Selecciona el presupuesto #70
4. Haz clic en "Editar"

### 3. Buscar estos LOGS en la consola

#### LOG 1: Datos que llegan del Backend
Busca: `🔴🔴🔴 [BUG-2.4x] DATOS DEL BACKEND`

```javascript
{
  presupuestoId: 70,
  cantidadItems: ?,
  totalesBackend: {
    totalPresupuesto: ?,
    totalHonorarios: ?,
    totalConHonorarios: ?,
    totalFinal: ?
  },
  sumaTotalesItems: ?,  // ← ANOTAR ESTE VALOR
  sumaMaterialesItems: ?,  // ← ANOTAR ESTE VALOR
  detalleItems: [...]
}
```

**✅ VALORES ESPERADOS CORRECTOS:**
- `totalPresupuesto`: 10,000,000
- `totalConHonorarios`: 16,500,000
- `sumaTotalesItems`: debería sumar aprox 16.5M (sin descuentos)

**❌ SI VES VALORES MULTIPLICADOS AQUÍ** → El problema está en el BACKEND
**✅ SI VES VALORES CORRECTOS AQUÍ** → El problema está en el FRONTEND (consolidación/UI)

---

#### LOG 2: Antes de Setear en Estado
Busca: `🔴🔴🔴 [BUG-2.4x] ANTES DE SETEAR EN ESTADO`

```javascript
{
  cantidadItems: ?,
  sumaTotales: ?,  // ← ANOTAR ESTE VALOR
  sumaMateriales: ?,  // ← ANOTAR ESTE VALOR
  detalleItems: [...]
}
```

**COMPARAR** este valor con el LOG 1:
- ¿Son iguales? → El problema está más adelante
- ¿Ya están multiplicados? → El problema está en el procesamiento (líneas 1555-1780)

---

#### LOG 3: Antes de Consolidar
Busca: `🔴🔴🔴 [BUG-2.4x] ANTES DE CONSOLIDAR`

```javascript
{
  cantidadItemsEstado: ?,
  sumaTotales: ?,  // ← ANOTAR ESTE VALOR
  sumaMateriales: ?,  // ← ANOTAR ESTE VALOR
  primeros3: [...]
}
```

**COMPARAR** con LOG 2:
- ¿Son iguales? → El problema está en la consolidación (useMemo)
- ¿Ya están multiplicados? → El problema está entre LOG 2 y LOG 3

---

#### LOG 4: Después de Consolidar
Busca: `🔴🔴🔴 [BUG-2.4x] DESPUÉS DE CONSOLIDAR`

```javascript
{
  cantidadGrupos: ?,
  totalConsolidado: ?,  // ← ANOTAR ESTE VALOR
  detalleGrupos: [
    {
      tipo: "Pintura",
      subtotalBase: ?,
      honorarios: ?,
      mayoresCostos: ?,
      totalFinal: ?,  // ← ANOTAR ESTE VALOR
      cantMateriales: ?,
      cantJornales: ?
    }
  ]
}
```

**VERIFICAR:**
- ¿`totalConsolidado` es correcto (~16.5M)? → El problema está en la UI (visualización)
- ¿`totalConsolidado` ya está multiplicado? → El problema está en el useMemo de consolidación

**PARA PRESUPUESTO #70 CON 3 ITEMS DE PINTURA:**
- Esperado: 3 items × $6M materiales = $18M base
- Con honorarios 100%: $18M + $18M = $36M
- Total final con otros conceptos: ~$16.5M

---

## POSIBLES CAUSAS SEGÚN DÓNDE SE VEA EL ERROR

### Si está multiplicado en LOG 1 (Backend)
- El backend está guardando valores incorrectos
- Revisar cálculo en PresupuestoNoClienteService líneas 544-548

### Si se multiplica entre LOG 1 y LOG 2 (Procesamiento)
- Revisar el useEffect líneas 1555-1780
- Verificar que no se dupliquen items
- Ver si se están sumando arrays dos veces

### Si se multiplica entre LOG 2 y LOG 3 (State)
- El estado `itemsCalculadora` tiene items duplicados
- Revisar cómo se llama `setItemsCalculadora`

### Si se multiplica en LOG 4 (Consolidación)
- El `useMemo` de consolidación está duplicando valores
- Revisar líneas 6300-6740
- Verificar que no se sumen honorarios dos veces
- Verificar que no se procesen items duplicados

### Si LOG 4 es correcto pero UI muestra mal (Visualización)
- El problema está en el render (líneas 14880-15050)
- Verificar el cálculo de `totalSinDescuento`
- Ver si no se está mostrando algún total parcial multiplicado

---

## PRÓXIMOS PASOS

1. **Ejecutar el diagnóstico** siguiendo los pasos de arriba
2. **Copiar TODOS los logs** que aparezcan con `[BUG-2.4x]`
3. **Pegar los resultados** en un mensaje para análisis
4. Basándose en dónde aparece la multiplicación, implementar el fix específico

---

## INFORMACIÓN ADICIONAL

### Valores Correctos Esperados (Presupuesto #70)
```
Base de Datos:
- totalPresupuesto: $10,000,000.00
- totalHonorariosCalculado: $10,000,000.00
- totalPresupuestoConHonorarios: $16,500,000.00
- Items: 3 × Pintura con $6M materiales c/u = $18M total materiales
- Honorarios materiales: 100% sobre $18M = $18M adicionales
```

### Archivos Involucrados
- `PresupuestoNoClienteModal.jsx` líneas 1555-1780 (carga inicial)
- `PresupuestoNoClienteModal.jsx` líneas 6300-6740 (consolidación)
- `PresupuestoNoClienteModal.jsx` líneas 14880-15050 (visualización)
- `api.js` línea 1058 (getById con forceNoCache)

### Comando para Ver Datos del Backend Directamente
```bash
# En PowerShell o navegador
curl "http://localhost:8080/api/v1/presupuestos-no-cliente/70?empresaId=1"
```

Verificar que los valores retornados sean:
- `totalPresupuesto`: 10000000.00
- `totalPresupuestoConHonorarios`: 16500000.00
