# 🎯 Sistema de Adelantos - Guía Rápida de Uso

## ✅ ¿Qué se implementó?

Se implementó un **sistema completo de adelantos** que permite dar pagos anticipados a profesionales y descuentarlos automáticamente en futuros pagos.

---

## 🚀 Cómo Usarlo (Paso a Paso)

### 1️⃣ Acceder al Sistema de Adelantos

1. Abrir la aplicación
2. Ir a **"Sistema Financiero"** (menú principal)
3. Buscar la sección **"💸 Gestión de Pagos"**
4. Click en la tarjeta **"💸 Dar Adelantos"**

![Ubicación del botón]
```
Sección: 💸 Gestión de Pagos
┌─────────────────────┐  ┌─────────────────────┐
│ Registrar Pago      │  │ Listar Pagos        │
└─────────────────────┘  └─────────────────────┘

┌─────────────────────┐
│ 💸 Dar Adelantos    │ ← NUEVO
│ Otorgar adelantos a │
│ profesionales       │
│ [Abrir Tarjeta]    │
└─────────────────────┘
```

---

### 2️⃣ Seleccionar Profesional

En el modal que se abre:

**Opción A: Selector único**
- Desplegable con todos los profesionales
- Muestra saldo disponible de cada uno
- Solo profesionales con saldo > $0

**Opción B: Modo múltiple** (próximamente)
- Checkboxes para seleccionar varios
- Mismo adelanto para todos

---

### 3️⃣ Configurar el Adelanto

#### a) Elegir Tipo

- 🔘 **1 Semana** → Adelanto semanal (~5 días de jornal)
- 🔘 **2 Semanas** → Adelanto quincenal (~10 días)
- 🔘 **1 Mes** → Adelanto mensual (~22 días)
- 🔘 **Toda la obra** → Sobre saldo total pendiente

**El sistema muestra el monto estimado automáticamente**

#### b) Ajustar Porcentaje

Deslizar el control entre **30%** y **80%**:

```
30% ━━━━●━━━━ 80%
        ↑
       50% (default)
```

#### c) Monto Final

El sistema calcula y muestra:

```
💰 Monto a Adelantar: $40,000
```

#### d) Método de Pago

Seleccionar:
- Efectivo
- Transferencia
- Cheque

#### e) Observaciones (opcional)

Agregar notas como:
- "Anticipo para compra de materiales"
- "Adelanto por emergencia familiar"
- etc.

---

### 4️⃣ Confirmar

1. Revisar que todo esté correcto
2. Click en **"✅ Confirmar Adelanto"**
3. Confirmar en el mensaje que aparece
4. ¡Listo! ✅

---

## 🔍 Ver Adelantos Activos

### En la tabla de profesionales:

Cuando un profesional tiene adelantos activos, verás:

```
Juan Pérez  💸 Adelanto: $30,000
            └── Badge naranja con el monto
```

### En el modal de adelantos:

Al seleccionar un profesional:

```
📊 Información Actual:
├─ Total asignado:    $500,000
├─ Total pagado:      $200,000
├─ Adelantos activos: $30,000  ⚠️
└─ Disponible:        $270,000
```

---

## 💸 Pagar con Adelantos Activos

### Proceso Automático

El viernes (o cuando pagues):

1. Ir a **"Registrar Pago"**
2. Seleccionar profesionales
3. Click en **"💸 Pagar Profesionales"**

**El sistema automáticamente:**

✅ Detecta adelantos activos
✅ Calcula descuento
✅ Resta del pago
✅ Actualiza saldos

### Ejemplo Real

**Estado antes del pago:**
```
Profesional: Juan Pérez
Trabajó esta semana: $100,000
Adelanto activo: $30,000
```

**El sistema calcula:**
```
Monto bruto:        $100,000
- Adelanto:         - $30,000
─────────────────────────────
= Monto neto:        $70,000 ✅
```

**Comprobante generado:**
```
═══════════════════════════════════════
         COMPROBANTE DE PAGO
═══════════════════════════════════════
Profesional: Juan Pérez
Fecha: 06/03/2026

Jornales trabajados:        5 días
Precio jornal:           $20,000
───────────────────────────────────────
SUBTOTAL:                $100,000

Descuentos:
  - Adelanto 02/03:      -$30,000
───────────────────────────────────────
NETO A PAGAR:             $70,000 ✅
═══════════════════════════════════════
```

---

## 📊 Ejemplos de Casos Comunes

### Caso 1: Adelanto Semanal Simple

**Lunes:**
- Profesional: María López
- Tipo: 1 Semana
- Jornal: $25,000/día
- Porcentaje: 50%
- **Adelanto: $62,500** (5 días × $25k × 50%)

**Viernes:**
- Trabajó: 5 días = $125,000
- Adelanto: -$62,500
- **Paga: $62,500** ✅

---

### Caso 2: Adelanto Mensual

**Inicio de mes:**
- Profesional: Carlos Ruiz
- Tipo: 1 Mes
- Jornal: $20,000/día
- Porcentaje: 60%
- **Adelanto: $264,000** (~22 días × $20k × 60%)

**A lo largo del mes:**
- Se va descontando en cada pago semanal
- Hasta que se descuente completamente

---

### Caso 3: Adelanto Total Obra

**Escenario:**
- Profesional: Ana García
- Saldo pendiente total: $500,000
- Porcentaje: 80%
- **Adelanto: $400,000**

**Nota:** Solo usar en casos especiales y acordados

---

## ⚠️ Consideraciones Importantes

### ✅ Buenas Prácticas

1. **Documentar el motivo** en observaciones
2. **No exceder el 60%** regularmente
3. **Comunicar al profesional** el descuento futuro
4. **Revisar adelantos activos** antes de dar más

### ❌ Evitar

1. Dar múltiples adelantos seguidos
2. Adelantos del 100% (usar máximo 80%)
3. Adelantos sin justificación
4. Olvidar comunicar al profesional

---

## 🔧 Solución de Problemas

### Problema: "No aparece el botón de Adelantos"

**Solución:**
1. Verificar que estás en Sistema Financiero
2. Revisar sección "💸 Gestión de Pagos"
3. Refrescar la página (F5)

---

### Problema: "No puedo seleccionar un profesional"

**Solución:**
1. Verificar que el profesional tenga saldo > $0
2. Verificar que no esté pagado completamente
3. Verificar que tenga asignación a obra válida

---

### Problema: "El adelanto no se descuenta del pago"

**Solución:**
1. Verificar que el adelanto esté ACTIVO
2. Verificar que el profesional sea el mismo
3. Revisar logs del navegador (F12)
4. Contactar soporte técnico

---

## 📱 Vista Previa de la Interfaz

### Modal de Dar Adelanto

```
┌─────────────────────────────────────────────┐
│ 💸 Dar Adelanto - Juan Pérez              ✕ │
├─────────────────────────────────────────────┤
│                                             │
│ 📊 Información Actual:                      │
│ ┌─────────────────────────────────────┐   │
│ │ Total asignado:       $500,000      │   │
│ │ Total pagado:         $200,000      │   │
│ │ Adelantos activos:    $0            │   │
│ │ Disponible:           $300,000      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ─────────────────────────────────────────  │
│                                             │
│ Tipo de Adelanto: *                         │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ● 1 Semana (1 semana)               │   │
│ │   Estimado: $20,000                 │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ○ 2 Semanas (2 semanas)             │   │
│ │   Estimado: $40,000                 │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ○ 1 Mes (4 semanas)                 │   │
│ │   Estimado: $80,000                 │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ○ Toda la obra                      │   │
│ │   Disponible: $300,000              │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ─────────────────────────────────────────  │
│                                             │
│ Porcentaje a Adelantar: 50%                 │
│ 30% ━━━━━●━━━━━ 80%                        │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 💰 Monto a Adelantar: $10,000       │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ Método de Pago: [Efectivo ▼]               │
│                                             │
│ Observaciones:                              │
│ ┌─────────────────────────────────────┐   │
│ │                                     │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ⚠️ Este adelanto se descontará             │
│    automáticamente de los próximos pagos   │
│                                             │
├─────────────────────────────────────────────┤
│        [Cancelar]  [✅ Confirmar Adelanto] │
└─────────────────────────────────────────────┘
```

---

## 🎓 Tips Pro

### 💡 Tip 1: Revisa Antes de Pagar

Antes del día de pago, revisa qué profesionales tienen adelantos:
- Busca badges **💸** en la tabla
- Verifica montos
- Comunica al profesional

### 💡 Tip 2: Usa Observaciones

Siempre documenta:
- Motivo del adelanto
- Acuerdos especiales
- Fecha de solicitud

### 💡 Tip 3: Porcentajes Recomendados

- **Urgencia menor**: 30-40%
- **Urgencia media**: 40-60%
- **Urgencia alta**: 60-80%
- **Nunca**: >80%

### 💡 Tip 4: Monitorea Adelantos

Revisa regularmente:
- Cuántos adelantos activos hay
- Montos totales
- Impacto en flujo de caja

---

## 📞 ¿Necesitas Ayuda?

1. **Documentación**: Lee [SISTEMA-ADELANTOS-README.md](./SISTEMA-ADELANTOS-README.md)
2. **Logs**: Abre consola (F12) y busca mensajes con 💸
3. **Backend**: Verifica que esté corriendo
4. **Soporte**: Contacta al equipo técnico

---

## ✅ Checklist de Primer Uso

Antes de usar en producción:

- [ ] Leer esta guía completa
- [ ] Probar con un profesional de prueba
- [ ] Verificar que el adelanto se registra
- [ ] Verificar que se descuenta en pago
- [ ] Revisar comprobante generado
- [ ] Capacitar a usuarios finales
- [ ] Definir políticas de adelantos
- [ ] Comunicar a profesionales

---

**¡Sistema listo para producción!** 🚀

Última actualización: 2 de marzo de 2026
