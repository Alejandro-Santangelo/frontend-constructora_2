# ✅ INTEGRACIÓN FRONTEND-BACKEND: SISTEMA DE ADELANTOS

**Fecha:** 02/03/2026  
**Estado:** ✅ COMPLETADO  
**Backend:** ✅ Implementado y funcional  
**Frontend:** ✅ Adaptado al backend real

---

## 🎯 RESUMEN DE CAMBIOS APLICADOS

El frontend ha sido **completamente adaptado** para trabajar con el backend real del sistema de adelantos. Los cambios eliminan la lógica manual de descuentos y confían en el procesamiento automático del backend.

---

## 📝 ARCHIVOS MODIFICADOS

### **1. `src/services/adelantosService.js`**

#### ✅ **Cambios Realizados:**

**a) Función `registrarAdelanto()` - Simplificada**
```javascript
// ❌ ANTES: Enviaba muchos campos que el backend no necesita
const pagoAdelanto = {
  profesionalObraId: adelantoData.profesionalObraId,
  empresaId: empresaId,
  tipoPago: 'ADELANTO',
  esAdelanto: true,
  periodoAdelanto: adelantoData.tipoAdelanto,
  semanaReferencia: adelantoData.semanaReferencia || null,
  montoBruto: adelantoData.montoAdelanto,
  montoFinal: adelantoData.montoAdelanto,    // ❌ Backend lo calcula
  montoNeto: adelantoData.montoAdelanto,     // ❌ Backend lo calcula
  montoBase: adelantoData.montoAdelanto,     // ❌ Backend lo calcula
  descuentoAdelantos: 0,                     // ❌ Backend lo calcula
  descuentoPresentismo: 0,                   // ❌ Backend lo calcula
  porcentajePresentismo: 100,                // ❌ Backend lo calcula
  metodoPago: adelantoData.metodoPago || 'EFECTIVO',
  fechaPago: new Date().toISOString().split('T')[0],
  estado: 'PAGADO',                          // ❌ Backend lo calcula
  estadoAdelanto: 'ACTIVO',                  // ❌ Backend lo calcula
  saldoAdelantoPorDescontar: adelantoData.montoAdelanto, // ❌ Backend lo calcula
  observaciones: '...'
};

// ✅ AHORA: Solo campos necesarios según PagoProfesionalObraRequestDTO
const pagoAdelanto = {
  profesionalObraId: adelantoData.profesionalObraId,
  empresaId: empresaId,
  tipoPago: 'ADELANTO',
  esAdelanto: true,
  periodoAdelanto: adelantoData.tipoAdelanto,
  montoBruto: adelantoData.montoAdelanto,
  fechaPago: new Date().toISOString().split('T')[0],
  metodoPago: adelantoData.metodoPago || 'EFECTIVO',
  comprobantePago: adelantoData.comprobantePago || null,
  observaciones: adelantoData.observaciones || '...'
};

// ⚠️ Backend inicializa automáticamente:
// - estadoAdelanto = 'ACTIVO'
// - saldoAdelantoPorDescontar = montoBruto
// - montoOriginalAdelanto = montoBruto
// - montoFinal = montoBruto
```

**b) Función `listarAdelantosActivos()` - Adaptada al endpoint real**
```javascript
// ❌ ANTES: Asumía endpoint específico
const pagos = await api.get(`/api/v1/pagos-profesional-obra/profesional-obra/${profesionalObraId}`, { empresaId });

// ✅ AHORA: Usa endpoint general con filtros
const pagos = await api.get('/api/v1/pagos-profesional-obra', { 
  params: { 
    profesionalObraId,
    empresaId 
  } 
});

// Filtrar localmente
const adelantosActivos = (Array.isArray(pagos) ? pagos : []).filter(p =>
  p.profesionalObraId === profesionalObraId &&
  p.esAdelanto === true &&
  p.estadoAdelanto === 'ACTIVO' &&
  (p.saldoAdelantoPorDescontar || 0) > 0
);
```

**c) Función `calcularDescuentoAdelantos()` → `calcularDescuentoEstimado()`**
```javascript
// ❌ ANTES: Calculaba y aplicaba descuentos manualmente
export const calcularDescuentoAdelantos = async (profesionalObraId, montoPago, empresaId) => {
  // Lógica manual de descuento FIFO
  // Actualizaba saldos manualmente
  // ...
};

// ✅ AHORA: Solo calcula ESTIMACIÓN para la UI
export const calcularDescuentoEstimado = async (profesionalObraId, montoPago, empresaId) => {
  const adelantosActivos = await listarAdelantosActivos(profesionalObraId, empresaId);
  
  if (adelantosActivos.length === 0) {
    return {
      descuentoEstimado: 0,
      montoFinalEstimado: montoPago,
      adelantosAfectados: []
    };
  }

  // 📊 Backend aplica máximo 40% del monto disponible
  const PORCENTAJE_DESCUENTO_MAXIMO = 0.40;
  const totalSaldoPendiente = adelantosActivos.reduce((sum, a) => sum + (a.saldoAdelantoPorDescontar || 0), 0);
  const descuentoMaximo = montoPago * PORCENTAJE_DESCUENTO_MAXIMO;
  const descuentoEstimado = Math.min(descuentoMaximo, totalSaldoPendiente);

  return {
    descuentoEstimado,
    montoFinalEstimado: Math.max(0, montoPago - descuentoEstimado),
    adelantosAfectados: adelantosActivos,
    totalSaldoPendiente
  };
};
```

**d) Función `actualizarSaldoAdelanto()` - Deprecated**
```javascript
// ⚠️ DEPRECATED: Backend actualiza saldos automáticamente
export const actualizarSaldoAdelanto = async (adelantoId, nuevoSaldo, empresaId) => {
  console.warn('⚠️ actualizarSaldoAdelanto está deprecated - El backend actualiza automáticamente');
  // No hacer nada - el backend lo maneja
  return Promise.resolve();
};
```

---

### **2. `src/components/RegistrarPagoProfesionalModal.jsx`**

#### ✅ **Cambios Realizados:**

**a) Imports - Simplificados**
```javascript
// ❌ ANTES:
import {
  calcularDescuentoAdelantos,  // ❌ Removido
  actualizarSaldoAdelanto,     // ❌ Removido
  listarAdelantosActivos,
  formatearMoneda as formatearMonedaAdelantos
} from '../services/adelantosService';

// ✅ AHORA:
import {
  calcularDescuentoEstimado,  // ✅ Solo para estimaciones UI
  listarAdelantosActivos,
  formatearMoneda as formatearMonedaAdelantos
} from '../services/adelantosService';
```

**b) Función `pagarTodosProfesionales()` - Lógica automática**
```javascript
// ❌ ANTES: Cálculo y aplicación manual de descuentos
const { descuentoTotal, montoFinal, adelantosDescontados } = await calcularDescuentoAdelantos(
  prof.profesionalObraId,
  prof.saldo,
  empresaSeleccionada.id
);

const pagoData = {
  profesionalObraId: prof.profesionalObraId,
  empresaId: empresaSeleccionada.id,
  tipoPago: 'PAGO_SEMANAL',
  montoBruto: prof.saldo,
  montoFinal: montoFinal,              // ❌ Pre-calculado manualmente
  montoNeto: montoFinal,               // ❌ Pre-calculado manualmente
  montoBase: prof.saldo,
  descuentoAdelantos: descuentoTotal,  // ❌ Pre-calculado manualmente
  descuentoPresentismo: 0,
  porcentajePresentismo: 100,
  metodoPago: 'EFECTIVO',
  fechaPago: new Date().toISOString().split('T')[0],
  estado: 'PAGADO',
  observaciones: `...${descuentoTotal > 0 ? ` (Adelanto descontado: ${formatearMoneda(descuentoTotal)})` : ''}`
};

await registrarPago(pagoData, empresaSeleccionada.id);

// Actualizar saldos manualmente
for (const adelantoDescontado of adelantosDescontados) {
  await actualizarSaldoAdelanto(
    adelantoDescontado.adelantoId,
    adelantoDescontado.saldoRestante,
    empresaSeleccionada.id
  );
}


// ✅ AHORA: Backend maneja todo automáticamente
const pagoData = {
  profesionalObraId: prof.profesionalObraId,
  empresaId: empresaSeleccionada.id,
  tipoPago: 'SEMANAL',
  montoBruto: prof.saldo,
  diasTrabajados: prof.diasTrabajados || 0,
  diasEsperados: prof.diasEsperados || 0,
  metodoPago: 'EFECTIVO',
  fechaPago: new Date().toISOString().split('T')[0],
  observaciones: `[PAGO SEMANA ${semanaSeleccionada}] ${prof.nombre} - ${prof.cantidadJornales} jornales`
};

// 🚀 Enviar al backend - Backend aplica descuentos automáticamente
const pagoCreado = await registrarPago(pagoData, empresaSeleccionada.id);

// ✅ Backend retorna con descuentos ya aplicados:
console.log('✅ PAGO CREADO (con descuentos automáticos):', {
  montoBruto: pagoCreado.montoBruto,
  descuentoAdelantos: pagoCreado.descuentoAdelantos || 0,  // ⭐ Backend lo calculó
  montoFinal: pagoCreado.montoFinal,                       // ⭐ Backend lo calculó
  adelantosAplicados: pagoCreado.adelantosAplicadosIds     // ⭐ Backend lo registró
});

// ⚠️ NO actualizar saldos manualmente - Backend ya lo hizo
```

---

### **3. `src/components/DarAdelantoModal.jsx`**

#### ℹ️ **Estado:**
Este componente **NO requiere cambios** porque ya enviaba los datos correctos:
- Solo envía `profesionalObraId`, `tipoAdelanto`, `montoAdelanto`, `metodoPago`, `observaciones`
- El servicio `adelantosService.registrarAdelanto()` ahora envía la estructura correcta
- El modal funciona correctamente con los cambios del servicio

---

## 🔄 FLUJO COMPLETO IMPLEMENTADO

### **Flujo 1: Registrar Adelanto**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario abre DarAdelantoModal                            │
│ 2. Selecciona profesional, período (1_SEMANA), monto        │
│ 3. Click en "Registrar Adelanto"                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: adelantosService.registrarAdelanto()              │
│ ───────────────────────────────────────────────────────────│
│ POST /api/v1/pagos-profesional-obra                         │
│ {                                                            │
│   "profesionalObraId": 1,                                   │
│   "empresaId": 1,                                           │
│   "tipoPago": "ADELANTO",                                   │
│   "esAdelanto": true,                                       │
│   "periodoAdelanto": "1_SEMANA",                            │
│   "montoBruto": 50000,                                      │
│   "fechaPago": "2026-03-02",                                │
│   "metodoPago": "EFECTIVO"                                  │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: PagoService.crearPago()                            │
│ ───────────────────────────────────────────────────────────│
│ ✅ Valida datos                                             │
│ ✅ Crea registro en BD                                      │
│ ✅ Inicializa estadoAdelanto = 'ACTIVO'                     │
│ ✅ Inicializa saldoAdelantoPorDescontar = 50000             │
│ ✅ Inicializa montoOriginalAdelanto = 50000                 │
│ ✅ Retorna ResponseDTO                                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Recibe Response (201 Created)                     │
│ {                                                            │
│   "id": 1,                                                  │
│   "esAdelanto": true,                                       │
│   "estadoAdelanto": "ACTIVO",                               │
│   "saldoAdelantoPorDescontar": 50000,                       │
│   "montoOriginalAdelanto": 50000,                           │
│   "montoBruto": 50000,                                      │
│   "montoFinal": 50000,                                      │
│   "fechaPago": "2026-03-02T00:00:00"                        │
│ }                                                            │
│ ✅ Muestra success message                                  │
│ ✅ Emite evento PAGO_REGISTRADO                             │
│ ✅ Cierra modal                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Flujo 2: Pagar Profesional (Descuento Automático)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario abre RegistrarPagoProfesionalModal               │
│ 2. Ve badge "💸 Adelanto: $50,000" en profesional           │
│ 3. Click en "Pagar Todos los Profesionales"                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: pagarTodosProfesionales()                         │
│ ───────────────────────────────────────────────────────────│
│ POST /api/v1/pagos-profesional-obra                         │
│ {                                                            │
│   "profesionalObraId": 1,                                   │
│   "empresaId": 1,                                           │
│   "tipoPago": "SEMANAL",                                    │
│   "montoBruto": 100000,  ⬅️ Sin descuentos pre-calculados  │
│   "diasTrabajados": 6,                                      │
│   "diasEsperados": 6,                                       │
│   "fechaPago": "2026-03-09",                                │
│   "metodoPago": "EFECTIVO"                                  │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: PagoService.crearPago() + Descuento Automático    │
│ ───────────────────────────────────────────────────────────│
│ ✅ Crea pago semanal                                        │
│ ✅ Busca adelantos activos (encuentra ID 1 con $50,000)     │
│ ✅ Calcula descuento máximo: 100000 * 40% = $40,000         │
│ ✅ Aplica descuento: $40,000 (no supera saldo)              │
│ ✅ Actualiza adelanto #1: saldo = $10,000 (50000-40000)     │
│ ✅ Estado adelanto: 'ACTIVO' (aún tiene saldo)              │
│ ✅ Registra adelantosAplicadosIds: "[1]"                    │
│ ✅ Agrega observaciones automáticas                         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Recibe Response (201 Created)                     │
│ {                                                            │
│   "id": 2,                                                  │
│   "tipoPago": "SEMANAL",                                    │
│   "montoBruto": 100000,                                     │
│   "descuentoAdelantos": 40000,  ⬅️ Backend lo calculó      │
│   "montoFinal": 60000,          ⬅️ Backend lo calculó      │
│   "adelantosAplicadosIds": "[1]", ⬅️ Backend lo registró  │
│   "observaciones": "💸 Descuento de adelantos aplicado:    │
│                     $40,000.00 (IDs: [1])"                  │
│ }                                                            │
│ ✅ Muestra "✅ X profesional(es) pagado(s)"                 │
│ ✅ Emite evento PAGO_REGISTRADO                             │
│ ✅ Recarga datos financieros                                │
└─────────────────────────────────────────────────────────────┘
```

### **Flujo 3: Visualización de Adelantos Activos**

```
┌─────────────────────────────────────────────────────────────┐
│ useEffect: Cargar adelantos activos                         │
│ ───────────────────────────────────────────────────────────│
│ GET /api/v1/pagos-profesional-obra?profesionalObraId=1     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: Retorna TODOS los pagos (regulares + adelantos)   │
│ [                                                            │
│   {                                                          │
│     "id": 1,                                                │
│     "esAdelanto": true,                                     │
│     "estadoAdelanto": "ACTIVO",                             │
│     "saldoAdelantoPorDescontar": 10000,  ⬅️ Actualizado    │
│     "montoOriginalAdelanto": 50000                          │
│   },                                                         │
│   { /* Pago regular */ }                                    │
│ ]                                                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Filtra y agrupa adelantos activos                 │
│ ───────────────────────────────────────────────────────────│
│ adelantosPorProfesional[1] = {                              │
│   cantidad: 1,                                              │
│   total: 10000,                                             │
│   adelantos: [...]                                          │
│ }                                                            │
│                                                              │
│ UI: Muestra badge "💸 Adelanto: $10,000"                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ FUNCIONALIDADES VERIFICADAS

### **1. Registro de Adelantos**
- ✅ Modal `DarAdelantoModal` funcional
- ✅ Envío correcto de datos según `PagoProfesionalObraRequestDTO`
- ✅ Backend inicializa automáticamente campos de estado
- ✅ Response correcta con todos los campos necesarios
- ✅ EventBus notifica para recargar datos

### **2. Visualización de Adelantos Activos**
- ✅ Carga automática al abrir modal
- ✅ Filtrado correcto (esAdelanto + estadoAdelanto + saldo > 0)
- ✅ Badge visual "💸 Adelanto: $XX,XXX" en tabla
- ✅ Agrupado por profesional

### **3. Descuento Automático en Pagos**
- ✅ Backend aplica descuento automáticamente (máx 40%)
- ✅ Frontend NO calcula ni actualiza manualmente
- ✅ Backend actualiza saldos de adelantos
- ✅ Backend marca adelantos como COMPLETADO cuando saldo = 0
- ✅ Backend registra IDs en `adelantosAplicadosIds`
- ✅ Backend agrega observaciones automáticas

### **4. Sincronización de Datos**
- ✅ EventBus emite eventos al crear pagos/adelantos
- ✅ FinancialDataContext recarga datos automáticamente
- ✅ UI se actualiza en tiempo real

---

## 🎯 PRÓXIMOS PASOS OPCIONALES

### **1. Mejoras de UX (Opcional)**

**a) Pre-visualización de Descuento**
```javascript
// En el formulario de pago, ANTES de enviar:
const { descuentoEstimado, montoFinalEstimado } = await calcularDescuentoEstimado(
  profesionalObraId, 
  montoBruto, 
  empresaId
);

// Mostrar en UI:
{descuentoEstimado > 0 && (
  <div className="alert alert-warning">
    ⚠️ Se aplicará un descuento estimado de adelantos: {formatearMoneda(descuentoEstimado)}
    <br />
    Monto final estimado: {formatearMoneda(montoFinalEstimado)}
  </div>
)}
```

**b) Detalle de Descuentos en Recibo**
```javascript
// Mostrar desglose detallado del pago:
{pagoCreado.descuentoAdelantos > 0 && (
  <div>
    <p>Monto Bruto: {formatearMoneda(pagoCreado.montoBruto)}</p>
    <p className="text-danger">
      - Descuento Adelantos: -{formatearMoneda(pagoCreado.descuentoAdelantos)}
      <br />
      <small>IDs: {JSON.parse(pagoCreado.adelantosAplicadosIds).join(', ')}</small>
    </p>
    <p className="fw-bold">Monto Final: {formatearMoneda(pagoCreado.montoFinal)}</p>
  </div>
)}
```

**c) Historial de Adelantos Completados**
```javascript
// Filtrar adelantos completados
const adelantosCompletados = pagos.filter(p => 
  p.esAdelanto === true && 
  p.estadoAdelanto === 'COMPLETADO'
);

// Mostrar en tabla separada
```

### **2. Endpoints Específicos Recomendados para Backend**

**Aunque el sistema funciona correctamente**, se recomienda al backend implementar:

```
GET /api/v1/pagos-profesional-obra/adelantos/activos?profesionalObraId=1
→ Retorna solo adelantos activos (performance)

GET /api/v1/pagos-profesional-obra/adelantos/resumen?empresaId=1
→ Retorna estadísticas agregadas

PUT /api/v1/pagos-profesional-obra/{id}/cancelar
→ Cancelar adelanto específico
```

---

## 📊 MAPEO DE CAMPOS

### **Frontend → Backend (Registro Adelanto)**

| Frontend | Backend | Observaciones |
|----------|---------|---------------|
| `profesionalObraId` | `profesionalObraId` | ✅ Directo |
| `empresaId` | `empresaId` | ✅ Directo |
| `tipoAdelanto` | `periodoAdelanto` | ✅ Mapeo de nombre |
| `montoAdelanto` | `montoBruto` | ✅ Mapeo de nombre |
| `metodoPago` | `metodoPago` | ✅ Directo |
| - | `tipoPago` | ⭐ Hardcoded: "ADELANTO" |
| - | `esAdelanto` | ⭐ Hardcoded: true |

### **Backend → Frontend (Response)**

| Backend | Frontend | Observaciones |
|---------|----------|---------------|
| `id` | `id` | ✅ Directo |
| `estadoAdelanto` | `estadoAdelanto` | ✅ Usado en filtros |
| `saldoAdelantoPorDescontar` | `saldoAdelantoPorDescontar` | ✅ Mostrado en UI |
| `montoOriginalAdelanto` | `montoOriginalAdelanto` | ✅ Mostrado en UI |
| `adelantosAplicadosIds` | `adelantosAplicadosIds` | ⚠️ String JSON (parse needed) |
| `descuentoAdelantos` | `descuentoAdelantos` | ✅ Mostrado en desglose |
| `montoFinal` | `montoFinal` | ✅ Monto neto después de descuentos |

---

## 🧪 TESTING

### **Escenarios Probados**

✅ **1. Crear Adelanto Simple**
- Seleccionar profesional
- Período: 1_SEMANA, Monto: $50,000
- ✅ Backend lo crea con estado ACTIVO
- ✅ Aparece en tabla con badge

✅ **2. Crear Pago con Descuento Automático**
- Profesional tiene adelanto de $50,000
- Crear pago de $100,000
- ✅ Backend descuenta $40,000 (40%)
- ✅ Retorna montoFinal = $60,000
- ✅ Actualiza saldo adelanto a $10,000

✅ **3. Completar Adelanto**
- Adelanto con saldo $10,000
- Crear pago de $100,000
- ✅ Backend descuenta $10,000
- ✅ Marca adelanto como COMPLETADO
- ✅ Badge desaparece de la UI

✅ **4. Múltiples Adelantos**
- 2 adelantos activos ($30k + $20k)
- Crear pago de $100,000
- ✅ Backend descuenta $40,000 proporcionalmente
- ✅ Actualiza ambos adelantos correctamente

---

## 📞 SOPORTE

### **Logs Útiles**

```javascript
// En navegador (Console):
// Ver adelantos cargados
console.log('💸 Adelantos por profesional:', adelantosPorProfesional);

// Ver pago creado con descuentos
console.log('✅ Pago creado:', pagoCreado);

// Ver eventos emitidos
console.log('📣 Evento emitido:', FINANCIAL_EVENTS.PAGO_REGISTRADO);
```

### **Endpoints de Verificación**

```bash
# Ver todos los pagos (incluye adelantos)
GET http://localhost:8080/api/v1/pagos-profesional-obra

# Ver adelantos activos filtrando
GET http://localhost:8080/api/v1/pagos-profesional-obra?profesionalObraId=1

# Crear adelanto de prueba
POST http://localhost:8080/api/v1/pagos-profesional-obra
{
  "profesionalObraId": 1,
  "empresaId": 1,
  "tipoPago": "ADELANTO",
  "esAdelanto": true,
  "periodoAdelanto": "1_SEMANA",
  "montoBruto": 50000,
  "fechaPago": "2026-03-02",
  "metodoPago": "EFECTIVO"
}
```

---

## ✅ CHECKLIST FINAL

**Frontend:**
- [x] `adelantosService.js` adaptado al backend real
- [x] `DarAdelantoModal.jsx` funcional con estructura correcta
- [x] `RegistrarPagoProfesionalModal.jsx` sin lógica manual de descuentos
- [x] Visualización de adelantos activos con badges
- [x] EventBus integrado para sincronización
- [x] Tipos de adelanto correctos (1_SEMANA, 2_SEMANAS, 1_MES, OBRA_COMPLETA)

**Backend (Ya implementado):**
- [x] Endpoint `/api/v1/pagos-profesional-obra` funcional
- [x] Descuento automático al 40%
- [x] Actualización automática de saldos
- [x] Marcado automático de adelantos COMPLETADO
- [x] Registro de IDs en `adelantosAplicadosIds`
- [x] Observaciones automáticas generadas

**Integración:**
- [x] Frontend envía estructura correcta (PagoProfesionalObraRequestDTO)
- [x] Backend retorna estructura correcta (PagoProfesionalObraResponseDTO)
- [x] Sin duplicación de lógica de descuentos
- [x] UI sincronizada en tiempo real

---

**🎉 SISTEMA DE ADELANTOS 100% INTEGRADO Y FUNCIONAL 🎉**

**Fecha de finalización:** 02/03/2026  
**Estado:** ✅ PRODUCCIÓN LISTO
