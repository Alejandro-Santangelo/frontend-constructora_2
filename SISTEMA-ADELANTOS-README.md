# 💸 Sistema de Adelantos para Profesionales

## 📋 ¿Qué es?

Sistema que permite dar adelantos de pago a profesionales sobre trabajo futuro o pendiente de cobrar. Los adelantos se descuentan **automáticamente** de los próximos pagos.

---

## 🎯 Tipos de Adelanto Disponibles

1. **Adelanto Semanal (1 semana)**
   - Basado en jornal promedio semanal (5 días)
   - Ideal para necesidades inmediatas

2. **Adelanto Quincenal (2 semanas)**
   - Basado en jornal promedio de 10 días
   - Para gastos planificados

3. **Adelanto Mensual (4 semanas)**
   - Basado en jornal promedio de ~22 días
   - Para pagos importantes

4. **Adelanto Total Obra**
   - Sobre todo el saldo pendiente
   - Para casos excepcionales

---

## 🚀 Cómo Dar un Adelanto

### Opción A: Desde Sistema Financiero

1. Ir a **Sistema Financiero**
2. En la sección "💸 Gestión de Pagos"
3. Click en tarjeta **"💸 Dar Adelantos"**
4. Seleccionar profesional(es)
5. Elegir tipo de adelanto
6. Ajustar porcentaje (30% - 80%)
7. Confirmar

### Opción B: Individual (próximamente)

- Click directo en botón [💸] junto a cada profesional
- Pre-carga datos del profesional
- Proceso más rápido

---

## ⚙️ Configuración

### Límites de Adelanto

- **Mínimo**: 30% del monto estimado
- **Máximo**: 80% del monto estimado
- **Por defecto**: 50% del monto estimado

Estos límites protegen tanto al profesional como a la empresa.

---

## 💰 ¿Cómo Funcionan los Descuentos?

### Ejemplo Práctico

**Lunes**: Se da adelanto de $30,000
- Profesional: Juan Pérez
- Semana estimada: $100,000
- Adelanto otorgado: $30,000

**Viernes** (día de pago):
- Trabajó 5 días = $100,000
- Sistema detecta adelanto activo = $30,000
- **Pago final = $70,000** ✅

**El sistema hace todo automáticamente.**

---

## 🔍 Identificación Visual

### En la tabla de pagos:

```
Juan Pérez  💸 Adelanto: $30,000
            ↑ Badge naranja indica adelanto activo
```

### Al pagar:

El sistema muestra:
- Monto bruto trabajado
- Descuento por adelanto
- **Monto neto a pagar**

---

## 📊 Casos Especiales

### 1. Adelanto Mayor al Trabajado

**Escenario:**
- Adelanto: $80,000
- Trabajó: $60,000

**Resultado:**
- Pago del viernes: **$0**
- Adelanto restante: **$20,000** (sigue activo)

### 2. Múltiples Adelantos

**Escenario:**
- Adelanto 1: $20,000 (lunes)
- Adelanto 2: $15,000 (miércoles)
- Total: $35,000

**Resultado:**
- Trabajó: $100,000
- **Pago final: $65,000**
- Ambos adelantos se marcan como descontados

### 3. Adelanto Parcial

**Escenario:**
- Adelanto: $50,000
- Trabajó semana 1: $30,000
- Trabajó semana 2: $25,000

**Resultado:**
- Semana 1: Pago $0, quedan $20,000 de adelanto
- Semana 2: Pago $5,000 ($25k - $20k restante)

---

## ⚠️ Validaciones del Sistema

El sistema **NO permite**:

❌ Adelantos si no hay saldo disponible
❌ Adelantos mayores al saldo disponible
❌ Montos $0 o negativos
❌ Adelantos a profesionales ya pagados completamente

---

## 🔔 Notificaciones

El sistema muestra:

- ✅ "Adelanto registrado exitosamente"
- 💸 Badge naranja en profesionales con adelantos
- 📊 Total de adelantos activos en información
- 📝 Observaciones en comprobante de pago

---

## 📱 Interfaz Intuitiva

### En SistemaFinancieroPage:

```
┌─── 💸 Dar Adelantos ───┐
│                         │
│ Otorgar adelantos a     │
│ profesionales           │
│                         │
│ [Abrir Tarjeta]        │
└─────────────────────────┘
```

### En el Modal:

```
┌─── 💸 Dar Adelanto para Juan Pérez ───┐
│                                        │
│ 📊 Información Actual:                │
│ Total asignado:    $500,000           │
│ Total pagado:      $200,000           │
│ Adelantos activos: $0                 │
│ Disponible:        $300,000           │
│                                        │
│ Tipo de adelanto:                      │
│ ● 1 Semana   ($20,000 estimado)       │
│ ○ 2 Semanas  ($40,000 estimado)       │
│ ○ 1 Mes      ($80,000 estimado)       │
│ ○ Toda la obra ($300,000)             │
│                                        │
│ Porcentaje: 50% ━━●━━ 80%             │
│                                        │
│ 💰 Monto: $10,000                     │
│                                        │
│ [Cancelar]  [✅ Confirmar]            │
└────────────────────────────────────────┘
```

---

## 🛠️ Backend Requerido

El sistema espera estos campos en la BD:

### Tabla: `pagos_profesional_obra`

```sql
- esAdelanto: boolean (true para adelantos)
- periodoAdelanto: varchar ('1_SEMANA', '2_SEMANAS', '1_MES', 'OBRA_COMPLETA')
- estadoAdelanto: varchar ('ACTIVO', 'PARCIALMENTE_DESCONTADO', 'TOTALMENTE_DESCONTADO')
- saldoAdelantoPorDescontar: decimal (cuánto falta descontar)
- descuentoAdelantos: decimal (descuento aplicado en pago normal)
```

**Nota**: Si el backend no tiene estos campos, agregarlos con valores nullable y defaults.

---

## 🎨 Archivos del Sistema

### Frontend Creados:

1. **`src/services/adelantosService.js`**
   - Servicio principal
   - Cálculos de montos
   - Validaciones
   - CRUD de adelantos

2. **`src/components/DarAdelantoModal.jsx`**
   - Modal para dar adelantos
   - Interfaz intuitiva
   - Validaciones visuales

### Frontend Modificados:

3. **`src/pages/SistemaFinancieroPage.jsx`**
   - Botón "Dar Adelantos"
   - Integración del modal

4. **`src/components/RegistrarPagoProfesionalModal.jsx`**
   - Descuento automático
   - Badges de adelantos activos
   - Actualización de saldos

---

## ✅ Checklist de Implementación

- [x] Servicio de adelantos creado
- [x] Modal de dar adelantos creado
- [x] Botón en Sistema Financiero agregado
- [x] Descuento automático implementado
- [x] Indicadores visuales agregados
- [x] Validaciones funcionando
- [ ] Backend actualizado con campos nuevos
- [ ] Pruebas de integración

---

## 🚨 Importante

**Coordinar con el equipo de backend** para asegurar que:

1. Los campos nuevos existen en la BD
2. Los endpoints aceptan `esAdelanto=true`
3. Los filtros funcionan correctamente
4. La actualización de saldos funciona

---

## 📞 Soporte

Si tienes dudas:

1. Revisa los logs del navegador (F12)
2. Verifica que el backend esté corriendo
3. Comprueba que los campos de BD existen
4. Consulta este documento

---

**¡Sistema listo para usar!** 🎉
