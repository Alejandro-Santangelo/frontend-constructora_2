# 💸 ESPECIFICACIÓN TÉCNICA: SISTEMA DE ADELANTOS A PROFESIONALES - BACKEND

**Documento para equipo de Backend**  
**Fecha:** 02/03/2026  
**Versión:** 1.0  
**Estado:** 📝 PENDIENTE IMPLEMENTACIÓN  
**Prioridad:** 🔥 ALTA

---

## 🎯 RESUMEN EJECUTIVO

El **Sistema de Adelantos** permite dar pagos anticipados a profesionales que luego se descuentan automáticamente de sus pagos semanales regulares. El frontend ya está implementado y operativo, requiere soporte backend completo.

### **Funcionalidades Implementadas en Frontend:**
- ✅ Registrar adelantos (1 semana, 2 semanas, 1 mes, obra completa)
- ✅ Cálculo por porcentaje o monto fijo
- ✅ Selección individual o múltiple de profesionales
- ✅ Visualización de adelantos activos por profesional
- ✅ Descuento automático en pagos regulares
- ✅ Badges y alertas visuales de adelantos activos
- ✅ Validaciones de saldo disponible

### **Lo que necesita el Backend:**
1. 🆕 **Nuevos campos en tabla `pagos_profesional_obra`**
2. 🔧 **Modificación del endpoint POST `/api/v1/pagos-profesional-obra`**
3. 🔧 **Modificación del endpoint GET (listar pagos)**
4. 🆕 **Lógica de descuento automático**
5. 🆕 **Actualización de saldo pendiente de adelantos**
6. ✅ **Validaciones de negocio**

---

## 📊 ARQUITECTURA DEL SISTEMA

### **Flujo de Datos:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Implementado)                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Usuario selecciona profesional(es) y período                │
│  2. Calcula monto estimado según período                        │
│  3. Usuario elige: % del período o monto fijo                   │
│  4. Valida saldo disponible                                     │
│  5. Envía POST /api/v1/pagos-profesional-obra con esAdelanto    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (A implementar)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Recibe pago con esAdelanto=true                             │
│  2. Valida datos y saldo disponible                             │
│  3. Guarda en BD con nuevos campos de adelanto                  │
│  4. Retorna adelanto creado                                     │
│                                                                  │
│  --- DESPUÉS, en pagos regulares ---                            │
│                                                                  │
│  5. Al registrar pago regular, busca adelantos activos          │
│  6. Calcula descuento automático                                │
│  7. Actualiza saldoAdelantoPorDescontar                         │
│  8. Marca adelanto como COMPLETADO si saldo = 0                 │
│  9. Aplica descuento al pago regular                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ MODELO DE DATOS

### **Tabla: `pagos_profesional_obra`**

**Campos Existentes** (mantener sin cambios):
```sql
id                    BIGINT PRIMARY KEY AUTO_INCREMENT
profesional_obra_id   BIGINT NOT NULL
empresa_id            BIGINT NOT NULL
tipo_pago             VARCHAR(50)
monto_bruto           DECIMAL(10,2)
monto_final           DECIMAL(10,2)
monto_neto            DECIMAL(10,2)
descuento_presentismo DECIMAL(10,2)
porcentaje_presentismo INT
metodo_pago           VARCHAR(50)
fecha_pago            DATE
estado                VARCHAR(50)
observaciones         TEXT
created_at            TIMESTAMP
updated_at            TIMESTAMP
...otros campos existentes...
```

**🆕 NUEVOS CAMPOS NECESARIOS:**

```sql
-- IDENTIFICACIÓN DE ADELANTOS
es_adelanto                    BOOLEAN DEFAULT FALSE
periodo_adelanto               VARCHAR(50)  -- '1_SEMANA', '2_SEMANAS', '1_MES', 'OBRA_COMPLETA'
estado_adelanto                VARCHAR(50)  -- 'ACTIVO', 'COMPLETADO', 'CANCELADO'

-- CONTROL DE SALDO
saldo_adelanto_por_descontar   DECIMAL(10,2) DEFAULT 0.00
monto_original_adelanto        DECIMAL(10,2) DEFAULT 0.00

-- DESCUENTOS EN PAGOS REGULARES
descuento_adelantos            DECIMAL(10,2) DEFAULT 0.00
adelantos_aplicados_ids        JSON  -- Array de IDs de adelantos que se descontaron

-- REFERENCIAS
semana_referencia              DATE
```

### **Tipos de Datos - Enums:**

```sql
-- tipo_pago (ENUM existente - agregar valor)
'SEMANAL', 'QUINCENAL', 'MENSUAL', 'ADELANTO' ⭐ NUEVO

-- estado (ENUM existente - sin cambios)
'PENDIENTE', 'PAGADO', 'CANCELADO'

-- 🆕 periodo_adelanto (NUEVO ENUM)
'1_SEMANA', '2_SEMANAS', '1_MES', 'OBRA_COMPLETA'

-- 🆕 estado_adelanto (NUEVO ENUM)
'ACTIVO', 'COMPLETADO', 'CANCELADO'

-- metodo_pago (ENUM existente - sin cambios)
'EFECTIVO', 'TRANSFERENCIA', 'CHEQUE'
```

---

## 🔧 SCRIPTS SQL PARA EJECUCIÓN MANUAL

### ⚠️ IMPORTANTE: PROCESO PASO A PASO

**Estos scripts se ejecutan UNO POR UNO en el orden indicado. Después de cada ejecución:**
1. ✅ Ejecutar el script
2. 📊 Mostrarme el resultado/output
3. 🔍 Analizar juntos si fue exitoso
4. ➡️ Pasar al siguiente

---

### 📝 **SCRIPT 1: Verificación de Tabla Existente**

```sql
-- Verificar estructura actual de la tabla
DESCRIBE pagos_profesional_obra;

-- Verificar si ya existen algunos campos de adelanto
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND TABLE_SCHEMA = DATABASE()
    AND COLUMN_NAME IN (
        'es_adelanto', 
        'periodo_adelanto', 
        'estado_adelanto',
        'saldo_adelanto_por_descontar',
        'descuento_adelantos'
    )
ORDER BY 
    ORDINAL_POSITION;
```

**🎯 Objetivo:** Verificar qué campos ya existen para no duplicar.

**📊 Resultado Esperado:** Lista vacía o campos existentes.

---

### 📝 **SCRIPT 2: Agregar Campo `es_adelanto`**

```sql
-- Agregar campo booleano para identificar adelantos
ALTER TABLE pagos_profesional_obra 
ADD COLUMN es_adelanto BOOLEAN DEFAULT FALSE 
COMMENT 'Indica si este pago es un adelanto (true) o pago regular (false)';

-- Verificar que se agregó correctamente
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_DEFAULT, 
    IS_NULLABLE
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'es_adelanto' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Identificar pagos que son adelantos vs pagos regulares.

**📊 Resultado Esperado:** 
```
COLUMN_NAME   | COLUMN_TYPE | COLUMN_DEFAULT | IS_NULLABLE
es_adelanto   | tinyint(1)  | 0              | YES
```

---

### 📝 **SCRIPT 3: Agregar Campo `periodo_adelanto`**

```sql
-- Agregar campo para tipo de período del adelanto
ALTER TABLE pagos_profesional_obra 
ADD COLUMN periodo_adelanto VARCHAR(50) NULL 
COMMENT 'Tipo de adelanto: 1_SEMANA, 2_SEMANAS, 1_MES, OBRA_COMPLETA';

-- Crear índice para optimizar consultas
CREATE INDEX idx_periodo_adelanto 
ON pagos_profesional_obra(periodo_adelanto);

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'periodo_adelanto' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Saber qué tipo de adelanto se registró (semanal, quincenal, etc.).

**📊 Resultado Esperado:** Campo creado + índice creado.

---

### 📝 **SCRIPT 4: Agregar Campo `estado_adelanto`**

```sql
-- Agregar campo para estado del adelanto
ALTER TABLE pagos_profesional_obra 
ADD COLUMN estado_adelanto VARCHAR(50) NULL DEFAULT 'ACTIVO'
COMMENT 'Estado del adelanto: ACTIVO, COMPLETADO, CANCELADO';

-- Crear índice compuesto para consultas eficientes
CREATE INDEX idx_adelanto_estado 
ON pagos_profesional_obra(es_adelanto, estado_adelanto);

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_DEFAULT
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'estado_adelanto' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Controlar el ciclo de vida del adelanto (activo → completado).

**📊 Resultado Esperado:** Campo creado con default 'ACTIVO' + índice compuesto.

---

### 📝 **SCRIPT 5: Agregar Campo `saldo_adelanto_por_descontar`**

```sql
-- Agregar campo para saldo pendiente del adelanto
ALTER TABLE pagos_profesional_obra 
ADD COLUMN saldo_adelanto_por_descontar DECIMAL(10,2) DEFAULT 0.00
COMMENT 'Saldo pendiente por descontar del adelanto. Empieza igual a montoFinal y se va reduciendo.';

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_DEFAULT
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'saldo_adelanto_por_descontar' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Rastrear cuánto falta descontar de cada adelanto.

**📊 Resultado Esperado:** Campo DECIMAL(10,2) con default 0.00.

---

### 📝 **SCRIPT 6: Agregar Campo `monto_original_adelanto`**

```sql
-- Agregar campo para guardar el monto original del adelanto
ALTER TABLE pagos_profesional_obra 
ADD COLUMN monto_original_adelanto DECIMAL(10,2) DEFAULT 0.00
COMMENT 'Monto original del adelanto para referencia histórica';

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_DEFAULT
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'monto_original_adelanto' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Mantener registro del monto original para auditoría.

**📊 Resultado Esperado:** Campo DECIMAL(10,2) con default 0.00.

---

### 📝 **SCRIPT 7: Agregar Campo `descuento_adelantos`**

```sql
-- Agregar campo para el descuento aplicado por adelantos en pagos regulares
ALTER TABLE pagos_profesional_obra 
ADD COLUMN descuento_adelantos DECIMAL(10,2) DEFAULT 0.00
COMMENT 'Monto descontado del pago regular por adelantos activos';

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_DEFAULT
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'descuento_adelantos' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Registrar cuánto se descontó en cada pago regular.

**📊 Resultado Esperado:** Campo DECIMAL(10,2) con default 0.00.

---

### 📝 **SCRIPT 8: Agregar Campo `adelantos_aplicados_ids`**

```sql
-- Agregar campo JSON para IDs de adelantos descontados
ALTER TABLE pagos_profesional_obra 
ADD COLUMN adelantos_aplicados_ids JSON NULL
COMMENT 'Array de IDs de adelantos que se descontaron en este pago: [1, 5, 8]';

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'adelantos_aplicados_ids' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Rastrear qué adelantos específicos se descontaron en cada pago.

**📊 Resultado Esperado:** Campo JSON nullable.

---

### 📝 **SCRIPT 9: Agregar Campo `semana_referencia`**

```sql
-- Agregar campo para semana de referencia del adelanto
ALTER TABLE pagos_profesional_obra 
ADD COLUMN semana_referencia DATE NULL
COMMENT 'Fecha de referencia de la semana del adelanto';

-- Verificar
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'semana_referencia' 
    AND TABLE_SCHEMA = DATABASE();
```

**🎯 Objetivo:** Asociar adelanto a una semana específica.

**📊 Resultado Esperado:** Campo DATE nullable.

---

### 📝 **SCRIPT 10: Agregar Valor a ENUM `tipo_pago`**

```sql
-- Primero, verificar valores actuales del ENUM
SELECT 
    COLUMN_TYPE 
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND COLUMN_NAME = 'tipo_pago'
    AND TABLE_SCHEMA = DATABASE();

-- ⚠️ IMPORTANTE: Ajustar este script según el resultado anterior
-- Si tipo_pago es VARCHAR, no hace falta modificar
-- Si es ENUM, ejecutar esto:

-- OPCIÓN A: Si tipo_pago es VARCHAR (más probable)
-- No hace falta modificar, ya acepta 'ADELANTO'

-- OPCIÓN B: Si tipo_pago es ENUM, agregar valor
-- ALTER TABLE pagos_profesional_obra 
-- MODIFY tipo_pago ENUM('SEMANAL', 'QUINCENAL', 'MENSUAL', 'ADELANTO', ...otros valores existentes...);
```

**🎯 Objetivo:** Permitir tipo_pago = 'ADELANTO'.

**📊 Primero ejecutar SELECT para ver si es VARCHAR o ENUM.**

---

### 📝 **SCRIPT 11: Verificación Final de Estructura**

```sql
-- Ver todos los campos nuevos creados
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS 
WHERE 
    TABLE_NAME = 'pagos_profesional_obra' 
    AND TABLE_SCHEMA = DATABASE()
    AND (
        COLUMN_NAME LIKE '%adelanto%' 
        OR COLUMN_NAME = 'descuento_adelantos'
        OR COLUMN_NAME = 'semana_referencia'
    )
ORDER BY 
    ORDINAL_POSITION;

-- Ver índices creados
SHOW INDEX FROM pagos_profesional_obra 
WHERE Key_name LIKE '%adelanto%';
```

**🎯 Objetivo:** Confirmar que todos los campos se crearon correctamente.

**📊 Resultado Esperado:** Lista de todos los campos nuevos con sus tipos y configuraciones.

---

### 📝 **SCRIPT 12: Datos de Prueba (OPCIONAL)**

```sql
-- SOLO PARA AMBIENTE DE DESARROLLO/TESTING
-- NO ejecutar en producción sin datos reales

-- Insertar un adelanto de prueba
INSERT INTO pagos_profesional_obra (
    profesional_obra_id,
    empresa_id,
    tipo_pago,
    es_adelanto,
    periodo_adelanto,
    estado_adelanto,
    monto_bruto,
    monto_final,
    monto_neto,
    saldo_adelanto_por_descontar,
    monto_original_adelanto,
    descuento_adelantos,
    descuento_presentismo,
    porcentaje_presentismo,
    metodo_pago,
    fecha_pago,
    estado,
    observaciones
) VALUES (
    1,  -- Ajustar a un profesional_obra_id real
    1,  -- Ajustar a empresa_id real
    'ADELANTO',
    TRUE,
    '1_SEMANA',
    'ACTIVO',
    50000.00,
    50000.00,
    50000.00,
    50000.00,  -- Saldo completo por descontar
    50000.00,  -- Monto original
    0.00,      -- Sin descuentos en el adelanto mismo
    0.00,
    100,
    'EFECTIVO',
    CURDATE(),
    'PAGADO',
    '💸 ADELANTO Adelanto Semanal (1 semana) - Monto: $50,000.00'
);

-- Verificar que se insertó correctamente
SELECT 
    id,
    profesional_obra_id,
    tipo_pago,
    es_adelanto,
    periodo_adelanto,
    estado_adelanto,
    monto_final,
    saldo_adelanto_por_descontar,
    fecha_pago
FROM 
    pagos_profesional_obra 
WHERE 
    es_adelanto = TRUE
ORDER BY 
    id DESC 
LIMIT 5;
```

**🎯 Objetivo:** Crear registro de prueba para validar estructura.

**📊 Resultado Esperado:** 1 fila insertada con todos los campos correctos.

---

## 🔌 ENDPOINTS - ESPECIFICACIÓN DETALLADA

### **1. POST `/api/v1/pagos-profesional-obra`** - Registrar Pago/Adelanto

**Descripción:** Registra un pago regular o un adelanto.

**Request Body - Adelanto:**
```json
{
  "profesionalObraId": 123,
  "empresaId": 1,
  "tipoPago": "ADELANTO",
  "esAdelanto": true,
  "periodoAdelanto": "1_SEMANA",
  "semanaReferencia": "2026-03-03",
  "montoBruto": 50000.00,
  "montoFinal": 50000.00,
  "montoNeto": 50000.00,
  "montoBase": 50000.00,
  "descuentoAdelantos": 0,
  "descuentoPresentismo": 0,
  "porcentajePresentismo": 100,
  "metodoPago": "EFECTIVO",
  "fechaPago": "2026-03-02",
  "estado": "PAGADO",
  "estadoAdelanto": "ACTIVO",
  "saldoAdelantoPorDescontar": 50000.00,
  "observaciones": "💸 ADELANTO Adelanto Semanal - $50,000"
}
```

**Request Body - Pago Regular (con descuento de adelanto):**
```json
{
  "profesionalObraId": 123,
  "empresaId": 1,
  "tipoPago": "SEMANAL",
  "esAdelanto": false,
  "montoBruto": 75000.00,
  "montoFinal": 55000.00,
  "montoNeto": 55000.00,
  "descuentoAdelantos": 20000.00,  // ⭐ Descontado de adelantos activos
  "descuentoPresentismo": 0,
  "porcentajePresentismo": 100,
  "metodoPago": "TRANSFERENCIA",
  "fechaPago": "2026-03-09",
  "estado": "PAGADO",
  "adelantosAplicadosIds": [15, 18],  // IDs de adelantos descontados
  "observaciones": "Pago semanal con descuento de adelantos"
}
```

**Lógica del Backend:**

```javascript
// PSEUDO-CÓDIGO

async function crearPago(req, res) {
  const pagoData = req.body;
  
  // 1. VALIDAR DATOS
  if (!pagoData.profesionalObraId || !pagoData.empresaId) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }
  
  // 2. SI ES ADELANTO
  if (pagoData.esAdelanto === true) {
    // Establecer valores específicos de adelanto
    pagoData.estadoAdelanto = 'ACTIVO';
    pagoData.montoOriginalAdelanto = pagoData.montoFinal;
    pagoData.saldoAdelantoPorDescontar = pagoData.montoFinal;
    pagoData.tipoPago = 'ADELANTO';
    
    // Validar que no exceda saldo disponible
    const saldoDisponible = await calcularSaldoDisponible(
      pagoData.profesionalObraId, 
      pagoData.empresaId
    );
    
    if (pagoData.montoFinal > saldoDisponible) {
      return res.status(400).json({ 
        error: `Monto excede saldo disponible: ${saldoDisponible}` 
      });
    }
  }
  
  // 3. SI ES PAGO REGULAR
  else {
    // Buscar adelantos activos del profesional
    const adelantosActivos = await buscarAdelantosActivos(
      pagoData.profesionalObraId, 
      pagoData.empresaId
    );
    
    if (adelantosActivos.length > 0) {
      // Calcular descuento automático
      const descuento = calcularDescuentoAdelantos(
        pagoData.montoBruto, 
        adelantosActivos
      );
      
      pagoData.descuentoAdelantos = descuento.totalDescontado;
      pagoData.montoFinal = pagoData.montoBruto - descuento.totalDescontado;
      pagoData.adelantosAplicadosIds = descuento.adelantosIds;
      
      // Actualizar saldo de adelantos descontados
      await actualizarSaldosAdelantos(descuento.adelantosActualizados);
    }
  }
  
  // 4. GUARDAR EN BD
  const pagoCreado = await db.insert('pagos_profesional_obra', pagoData);
  
  return res.status(201).json(pagoCreado);
}

// Función auxiliar: Buscar adelantos activos
async function buscarAdelantosActivos(profesionalObraId, empresaId) {
  return await db.query(`
    SELECT * 
    FROM pagos_profesional_obra 
    WHERE profesional_obra_id = ? 
      AND empresa_id = ?
      AND es_adelanto = TRUE 
      AND estado_adelanto = 'ACTIVO'
      AND saldo_adelanto_por_descontar > 0
    ORDER BY fecha_pago ASC
  `, [profesionalObraId, empresaId]);
}

// Función auxiliar: Calcular descuento
function calcularDescuentoAdelantos(montoBruto, adelantosActivos) {
  let montoRestante = montoBruto;
  let totalDescontado = 0;
  const adelantosIds = [];
  const adelantosActualizados = [];
  
  for (const adelanto of adelantosActivos) {
    if (montoRestante <= 0) break;
    
    const saldoAdelanto = adelanto.saldoAdelantoPorDescontar;
    const montoADescontar = Math.min(montoRestante, saldoAdelanto);
    
    totalDescontado += montoADescontar;
    montoRestante -= montoADescontar;
    adelantosIds.push(adelanto.id);
    
    const nuevoSaldo = saldoAdelanto - montoADescontar;
    adelantosActualizados.push({
      id: adelanto.id,
      nuevoSaldo: nuevoSaldo,
      estadoAdelanto: nuevoSaldo <= 0 ? 'COMPLETADO' : 'ACTIVO'
    });
  }
  
  return {
    totalDescontado,
    adelantosIds,
    adelantosActualizados
  };
}

// Función auxiliar: Actualizar saldos
async function actualizarSaldosAdelantos(adelantosActualizados) {
  for (const adelanto of adelantosActualizados) {
    await db.update('pagos_profesional_obra', 
      { 
        saldo_adelanto_por_descontar: adelanto.nuevoSaldo,
        estado_adelanto: adelanto.estadoAdelanto,
        updated_at: new Date()
      },
      { id: adelanto.id }
    );
  }
}

// Función auxiliar: Calcular saldo disponible
async function calcularSaldoDisponible(profesionalObraId, empresaId) {
  // Obtener saldo total del profesional
  const profesionalObra = await db.queryOne(`
    SELECT saldo_pendiente 
    FROM profesionales_obra 
    WHERE id = ? AND empresa_id = ?
  `, [profesionalObraId, empresaId]);
  
  if (!profesionalObra) return 0;
  
  // Restar adelantos activos
  const totalAdelantosActivos = await db.queryOne(`
    SELECT SUM(saldo_adelanto_por_descontar) as total
    FROM pagos_profesional_obra 
    WHERE profesional_obra_id = ? 
      AND empresa_id = ?
      AND es_adelanto = TRUE 
      AND estado_adelanto = 'ACTIVO'
  `, [profesionalObraId, empresaId]);
  
  const saldoDisponible = profesionalObra.saldo_pendiente - 
                          (totalAdelantosActivos.total || 0);
  
  return Math.max(0, saldoDisponible);
}
```

**Response (201 Created):**
```json
{
  "id": 1547,
  "profesionalObraId": 123,
  "empresaId": 1,
  "tipoPago": "ADELANTO",
  "esAdelanto": true,
  "periodoAdelanto": "1_SEMANA",
  "estadoAdelanto": "ACTIVO",
  "montoBruto": 50000.00,
  "montoFinal": 50000.00,
  "montoNeto": 50000.00,
  "saldoAdelantoPorDescontar": 50000.00,
  "montoOriginalAdelanto": 50000.00,
  "metodoPago": "EFECTIVO",
  "fechaPago": "2026-03-02",
  "estado": "PAGADO",
  "createdAt": "2026-03-02T14:30:00Z"
}
```

**Error Responses:**
```json
// 400 - Monto excede saldo
{
  "error": "El monto solicitado ($80,000) excede el saldo disponible ($50,000)",
  "saldoDisponible": 50000.00,
  "montoSolicitado": 80000.00
}

// 400 - Datos faltantes
{
  "error": "Faltan campos requeridos: profesionalObraId, empresaId"
}

// 404 - Profesional no encontrado
{
  "error": "Profesional no encontrado con ID 999"
}
```

---

### **2. GET `/api/v1/pagos-profesional-obra/profesional-obra/:id`** - Listar Pagos

**Descripción:** Lista todos los pagos (incluyendo adelantos) de un profesional en una obra.

**Query Params:**
```
empresaId=1  (requerido)
incluirAdelantos=true  (opcional, default: true)
soloAdelantosActivos=false  (opcional, default: false)
```

**Request:**
```
GET /api/v1/pagos-profesional-obra/profesional-obra/123?empresaId=1&incluirAdelantos=true
```

**Response (200 OK):**
```json
[
  {
    "id": 1547,
    "profesionalObraId": 123,
    "tipoPago": "ADELANTO",
    "esAdelanto": true,
    "periodoAdelanto": "1_SEMANA",
    "estadoAdelanto": "ACTIVO",
    "montoFinal": 50000.00,
    "saldoAdelantoPorDescontar": 25000.00,
    "montoOriginalAdelanto": 50000.00,
    "fechaPago": "2026-03-02",
    "metodoPago": "EFECTIVO",
    "estado": "PAGADO"
  },
  {
    "id": 1550,
    "profesionalObraId": 123,
    "tipoPago": "SEMANAL",
    "esAdelanto": false,
    "montoFinal": 55000.00,
    "descuentoAdelantos": 25000.00,
    "adelantosAplicadosIds": [1547],
    "fechaPago": "2026-03-09",
    "metodoPago": "TRANSFERENCIA",
    "estado": "PAGADO"
  }
]
```

**Lógica del Backend:**

```javascript
async function listarPagosProfesional(req, res) {
  const { id } = req.params;  // profesionalObraId
  const { empresaId, incluirAdelantos = true, soloAdelantosActivos = false } = req.query;
  
  let query = `
    SELECT * 
    FROM pagos_profesional_obra 
    WHERE profesional_obra_id = ? 
      AND empresa_id = ?
  `;
  
  const params = [id, empresaId];
  
  if (soloAdelantosActivos) {
    query += ` AND es_adelanto = TRUE 
               AND estado_adelanto = 'ACTIVO' 
               AND saldo_adelanto_por_descontar > 0`;
  } else if (!incluirAdelantos) {
    query += ` AND (es_adelanto = FALSE OR es_adelanto IS NULL)`;
  }
  
  query += ` ORDER BY fecha_pago DESC`;
  
  const pagos = await db.query(query, params);
  
  return res.status(200).json(pagos);
}
```

---

### **3. PUT `/api/v1/pagos-profesional-obra/:id/cancelar-adelanto`** - Cancelar Adelanto

**Descripción:** Cancela un adelanto activo (marca como CANCELADO sin afectar pagos anteriores).

**Request:**
```
PUT /api/v1/pagos-profesional-obra/1547/cancelar-adelanto
Content-Type: application/json

{
  "empresaId": 1,
  "motivoCancelacion": "Error en el registro - duplicado"
}
```

**Lógica del Backend:**

```javascript
async function cancelarAdelanto(req, res) {
  const { id } = req.params;
  const { empresaId, motivoCancelacion } = req.body;
  
  // 1. Buscar adelanto
  const adelanto = await db.queryOne(`
    SELECT * 
    FROM pagos_profesional_obra 
    WHERE id = ? 
      AND empresa_id = ?
      AND es_adelanto = TRUE
  `, [id, empresaId]);
  
  if (!adelanto) {
    return res.status(404).json({ error: "Adelanto no encontrado" });
  }
  
  if (adelanto.estadoAdelanto === 'COMPLETADO') {
    return res.status(400).json({ 
      error: "No se puede cancelar un adelanto ya completado" 
    });
  }
  
  // 2. Actualizar estado
  await db.update('pagos_profesional_obra', {
    estadoAdelanto: 'CANCELADO',
    saldoAdelantoPorDescontar: 0,
    observaciones: `${adelanto.observaciones}\n\n⛔ CANCELADO: ${motivoCancelacion}`,
    updated_at: new Date()
  }, { id });
  
  // 3. Retornar adelanto actualizado
  const adelantoActualizado = await db.queryOne(
    'SELECT * FROM pagos_profesional_obra WHERE id = ?', 
    [id]
  );
  
  return res.status(200).json(adelantoActualizado);
}
```

**Response (200 OK):**
```json
{
  "id": 1547,
  "esAdelanto": true,
  "estadoAdelanto": "CANCELADO",
  "saldoAdelantoPorDescontar": 0,
  "observaciones": "💸 ADELANTO...\n\n⛔ CANCELADO: Error en el registro - duplicado"
}
```

---

### **4. GET `/api/v1/pagos-profesional-obra/adelantos/resumen`** - Resumen de Adelantos

**Descripción:** Obtiene resumen de adelantos por empresa.

**Request:**
```
GET /api/v1/pagos-profesional-obra/adelantos/resumen?empresaId=1
```

**Response (200 OK):**
```json
{
  "empresaId": 1,
  "totalAdelantosActivos": 5,
  "montoTotalActivo": 250000.00,
  "totalAdelantosCompletados": 12,
  "montoTotalCompletado": 480000.00,
  "adelantosPorPeriodo": {
    "1_SEMANA": { "cantidad": 8, "monto": 320000.00 },
    "2_SEMANAS": { "cantidad": 5, "monto": 250000.00 },
    "1_MES": { "cantidad": 3, "monto": 120000.00 },
    "OBRA_COMPLETA": { "cantidad": 1, "monto": 40000.00 }
  }
}
```

**Lógica del Backend:**

```javascript
async function resumenAdelantos(req, res) {
  const { empresaId } = req.query;
  
  const activos = await db.query(`
    SELECT COUNT(*) as cantidad, SUM(saldo_adelanto_por_descontar) as monto
    FROM pagos_profesional_obra 
    WHERE empresa_id = ? 
      AND es_adelanto = TRUE 
      AND estado_adelanto = 'ACTIVO'
  `, [empresaId]);
  
  const completados = await db.query(`
    SELECT COUNT(*) as cantidad, SUM(monto_original_adelanto) as monto
    FROM pagos_profesional_obra 
    WHERE empresa_id = ? 
      AND es_adelanto = TRUE 
      AND estado_adelanto = 'COMPLETADO'
  `, [empresaId]);
  
  const porPeriodo = await db.query(`
    SELECT 
      periodo_adelanto,
      COUNT(*) as cantidad,
      SUM(monto_original_adelanto) as monto
    FROM pagos_profesional_obra 
    WHERE empresa_id = ? 
      AND es_adelanto = TRUE
    GROUP BY periodo_adelanto
  `, [empresaId]);
  
  return res.status(200).json({
    empresaId,
    totalAdelantosActivos: activos[0].cantidad,
    montoTotalActivo: activos[0].monto || 0,
    totalAdelantosCompletados: completados[0].cantidad,
    montoTotalCompletado: completados[0].monto || 0,
    adelantosPorPeriodo: porPeriodo.reduce((acc, p) => {
      acc[p.periodo_adelanto] = { 
        cantidad: p.cantidad, 
        monto: p.monto 
      };
      return acc;
    }, {})
  });
}
```

---

## ✅ VALIDACIONES DE NEGOCIO

### **1. Al Crear Adelanto:**

```javascript
// ✅ Validar que hay saldo disponible
const saldoDisponible = await calcularSaldoDisponible(profesionalObraId, empresaId);
if (montoAdelanto > saldoDisponible) {
  throw new Error(`Saldo insuficiente. Disponible: ${saldoDisponible}`);
}

// ✅ Validar que el monto es positivo
if (montoAdelanto <= 0) {
  throw new Error('El monto debe ser mayor a 0');
}

// ✅ Validar período válido
const periodosValidos = ['1_SEMANA', '2_SEMANAS', '1_MES', 'OBRA_COMPLETA'];
if (!periodosValidos.includes(periodoAdelanto)) {
  throw new Error('Período de adelanto inválido');
}

// ✅ Validar que el profesional existe y está activo
const profesional = await db.queryOne(
  'SELECT * FROM profesionales_obra WHERE id = ? AND estado = "ACTIVO"',
  [profesionalObraId]
);
if (!profesional) {
  throw new Error('Profesional no encontrado o inactivo');
}
```

### **2. Al Registrar Pago Regular:**

```javascript
// ✅ Buscar adelantos activos automáticamente
const adelantosActivos = await buscarAdelantosActivos(profesionalObraId, empresaId);

// ✅ Si hay adelantos, calcular descuento obligatoriamente
if (adelantosActivos.length > 0) {
  const descuento = calcularDescuentoAdelantos(montoBruto, adelantosActivos);
  pagoData.descuentoAdelantos = descuento.totalDescontado;
  pagoData.montoFinal -= descuento.totalDescontado;
}

// ✅ El monto final no puede ser negativo
if (pagoData.montoFinal < 0) {
  pagoData.montoFinal = 0;
}
```

### **3. Al Cancelar Adelanto:**

```javascript
// ✅ No permitir cancelar adelantos completados
if (adelanto.estadoAdelanto === 'COMPLETADO') {
  throw new Error('No se puede cancelar un adelanto ya completado');
}

// ✅ Si ya se descontó parcialmente, advertir
if (adelanto.saldoAdelantoPorDescontar < adelanto.montoOriginalAdelanto) {
  console.warn(`Adelanto ${id} ya tiene descuentos aplicados`);
}
```

---

## 🔄 CASOS DE USO - FLUJO COMPLETO

### **Caso 1: Adelanto Simple - Descuento Completo en 1 Pago**

```
1. Frontend: Registrar adelanto de $50,000 (1 semana)
   POST /api/v1/pagos-profesional-obra
   {
     "esAdelanto": true,
     "periodoAdelanto": "1_SEMANA",
     "montoFinal": 50000,
     "saldoAdelantoPorDescontar": 50000,
     ...
   }
   
2. Backend: Guarda adelanto con estado_adelanto='ACTIVO'
   Responde: { id: 100, saldoAdelantoPorDescontar: 50000 }

3. Frontend: Una semana después, registrar pago semanal de $75,000
   POST /api/v1/pagos-profesional-obra
   {
     "esAdelanto": false,
     "tipoPago": "SEMANAL",
     "montoBruto": 75000,
     ...
   }

4. Backend: 
   - Detecta adelanto activo (id=100, saldo=50000)
   - Calcula descuento: min(75000, 50000) = 50000
   - Actualiza adelanto: saldoAdelantoPorDescontar=0, estadoAdelanto='COMPLETADO'
   - Guarda pago con: 
     * montoFinal=25000 (75000-50000)
     * descuentoAdelantos=50000
     * adelantosAplicadosIds=[100]
   
5. Resultado final:
   - Adelanto #100: COMPLETADO, saldo=0
   - Pago #101: montoBruto=75000, montoFinal=25000, descuentoAdelantos=50000
```

### **Caso 2: Adelanto Grande - Descuento en Múltiples Pagos**

```
1. Adelanto: $120,000 (1 mes)
   Guardado: { id: 200, saldoAdelantoPorDescontar: 120000 }

2. Pago semanal 1: montoBruto=$50,000
   Backend:
   - Descuenta: 50,000
   - Actualiza adelanto: saldoAdelantoPorDescontar=70000, estadoAdelanto='ACTIVO'
   - Guarda pago: montoFinal=0, descuentoAdelantos=50000

3. Pago semanal 2: montoBruto=$50,000
   Backend:
   - Descuenta: 50,000
   - Actualiza adelanto: saldoAdelantoPorDescontar=20000, estadoAdelanto='ACTIVO'
   - Guarda pago: montoFinal=0, descuentoAdelantos=50000

4. Pago semanal 3: montoBruto=$50,000
   Backend:
   - Descuenta: 20,000 (resto del adelanto)
   - Actualiza adelanto: saldoAdelantoPorDescontar=0, estadoAdelanto='COMPLETADO'
   - Guarda pago: montoFinal=30000, descuentoAdelantos=20000
```

### **Caso 3: Múltiples Adelantos Activos**

```
1. Adelanto A: $30,000 (saldo: 30000)
2. Adelanto B: $40,000 (saldo: 40000)
3. Total a descontar: $70,000

4. Pago semanal: montoBruto=$100,000
   Backend:
   - Descuenta adelanto A completo: 30,000
   - Actualiza A: saldo=0, estado='COMPLETADO'
   - Descuenta adelanto B completo: 40,000
   - Actualiza B: saldo=0, estado='COMPLETADO'
   - Guarda pago: 
     * montoFinal=30000 (100000-70000)
     * descuentoAdelantos=70000
     * adelantosAplicadosIds=[A, B]
```

---

## 🧪 TESTING - CASOS DE PRUEBA

### **Test 1: Crear Adelanto Válido**
```sql
-- Preparar datos
INSERT INTO profesionales_obra (id, empresa_id, saldo_pendiente) 
VALUES (999, 1, 100000);

-- Ejecutar desde Postman/Insomnia
POST /api/v1/pagos-profesional-obra
{
  "profesionalObraId": 999,
  "empresaId": 1,
  "esAdelanto": true,
  "periodoAdelanto": "1_SEMANA",
  "montoFinal": 50000,
  ...
}

-- Verificar en BD
SELECT * FROM pagos_profesional_obra 
WHERE profesional_obra_id = 999 
  AND es_adelanto = TRUE;

-- Esperado: 1 fila con saldo_adelanto_por_descontar=50000
```

### **Test 2: Rechazar Adelanto que Excede Saldo**
```javascript
// Pago con saldo_pendiente=30000
POST /api/v1/pagos-profesional-obra
{
  "montoFinal": 50000,  // Excede saldo
  ...
}

// Esperado: HTTP 400
{
  "error": "Monto excede saldo disponible"
}
```

### **Test 3: Descuento Automático en Pago Regular**
```javascript
// Dado: Adelanto activo de $50,000
// Cuando: Registrar pago de $75,000
POST /api/v1/pagos-profesional-obra
{
  "tipoPago": "SEMANAL",
  "montoBruto": 75000,
  ...
}

// Esperado: 
{
  "montoFinal": 25000,
  "descuentoAdelantos": 50000,
  "adelantosAplicadosIds": [id_adelanto]
}

// Y en BD:
SELECT saldo_adelanto_por_descontar, estado_adelanto
FROM pagos_profesional_obra
WHERE id = id_adelanto;

// Esperado: saldo=0, estado='COMPLETADO'
```

### **Test 4: Listar Solo Adelantos Activos**
```javascript
GET /api/v1/pagos-profesional-obra/profesional-obra/999?soloAdelantosActivos=true

// Esperado: Solo adelantos con estado_adelanto='ACTIVO' y saldo > 0
```

### **Test 5: Cancelar Adelanto**
```javascript
PUT /api/v1/pagos-profesional-obra/100/cancelar-adelanto
{
  "empresaId": 1,
  "motivoCancelacion": "Registro duplicado"
}

// Esperado:
{
  "estadoAdelanto": "CANCELADO",
  "saldoAdelantoPorDescontar": 0
}
```

---

## 📊 MÉTRICAS Y MONITOREO

### **Consultas SQL Útiles:**

```sql
-- Total de adelantos activos por empresa
SELECT 
    e.nombre as empresa,
    COUNT(*) as adelantos_activos,
    SUM(p.saldo_adelanto_por_descontar) as monto_total_activo
FROM 
    pagos_profesional_obra p
    JOIN empresas e ON p.empresa_id = e.id
WHERE 
    p.es_adelanto = TRUE 
    AND p.estado_adelanto = 'ACTIVO'
    AND p.saldo_adelanto_por_descontar > 0
GROUP BY 
    e.id;

-- Profesionales con más adelantos
SELECT 
    prof.nombre,
    COUNT(*) as cantidad_adelantos,
    SUM(p.monto_original_adelanto) as monto_total
FROM 
    pagos_profesional_obra p
    JOIN profesionales_obra po ON p.profesional_obra_id = po.id
    JOIN profesionales prof ON po.profesional_id = prof.id
WHERE 
    p.es_adelanto = TRUE
GROUP BY 
    prof.id
ORDER BY 
    cantidad_adelantos DESC
LIMIT 10;

-- Adelantos por estado
SELECT 
    estado_adelanto,
    COUNT(*) as cantidad,
    SUM(monto_original_adelanto) as monto_total,
    SUM(saldo_adelanto_por_descontar) as saldo_pendiente
FROM 
    pagos_profesional_obra
WHERE 
    es_adelanto = TRUE
GROUP BY 
    estado_adelanto;

-- Pagos con mayor descuento de adelantos
SELECT 
    p.id,
    p.fecha_pago,
    p.monto_bruto,
    p.descuento_adelantos,
    p.monto_final,
    prof.nombre as profesional
FROM 
    pagos_profesional_obra p
    JOIN profesionales_obra po ON p.profesional_obra_id = po.id
    JOIN profesionales prof ON po.profesional_id = prof.id
WHERE 
    p.descuento_adelantos > 0
ORDER BY 
    p.descuento_adelantos DESC
LIMIT 20;
```

---

## 🚨 CONSIDERACIONES DE SEGURIDAD

### **1. Validación de Permisos**
```javascript
// Verificar que el usuario tiene permisos sobre la empresa
if (usuario.empresaId !== pagoData.empresaId) {
  if (!usuario.roles.includes('SUPER_ADMIN')) {
    throw new Error('No tiene permisos para acceder a esta empresa');
  }
}
```

### **2. Prevención de Manipulación de Saldos**
```javascript
// NO permitir que el frontend envíe saldoAdelantoPorDescontar
// Calcularlo siempre en el backend
pagoData.saldoAdelantoPorDescontar = pagoData.montoFinal;
pagoData.montoOriginalAdelanto = pagoData.montoFinal;
```

### **3. Transacciones Atómicas**
```javascript
// Al descontar adelantos, usar transacciones
await db.transaction(async (trx) => {
  // 1. Crear pago
  const pago = await trx.insert('pagos_profesional_obra', pagoData);
  
  // 2. Actualizar saldos de adelantos
  for (const adelanto of adelantosActualizados) {
    await trx.update('pagos_profesional_obra', 
      { saldo_adelanto_por_descontar: adelanto.nuevoSaldo },
      { id: adelanto.id }
    );
  }
  
  return pago;
});
```

### **4. Auditoría**
```javascript
// Registrar todas las operaciones con adelantos
await db.insert('auditoria_adelantos', {
  usuario_id: req.user.id,
  accion: 'CREAR_ADELANTO',
  adelanto_id: adelanto.id,
  monto: adelanto.montoFinal,
  timestamp: new Date()
});
```

---

## 📁 ESTRUCTURA DE RESPONSE COMPLETA

### **Pago/Adelanto Completo:**
```json
{
  "id": 1547,
  "profesionalObraId": 123,
  "empresaId": 1,
  "tipoPago": "ADELANTO",
  "esAdelanto": true,
  "periodoAdelanto": "1_SEMANA",
  "estadoAdelanto": "ACTIVO",
  "semanaReferencia": "2026-03-03",
  "montoBruto": 50000.00,
  "montoFinal": 50000.00,
  "montoNeto": 50000.00,
  "montoBase": 50000.00,
  "saldoAdelantoPorDescontar": 50000.00,
  "montoOriginalAdelanto": 50000.00,
  "descuentoAdelantos": 0,
  "descuentoPresentismo": 0,
  "porcentajePresentismo": 100,
  "adelantosAplicadosIds": null,
  "metodoPago": "EFECTIVO",
  "fechaPago": "2026-03-02",
  "estado": "PAGADO",
  "observaciones": "💸 ADELANTO Adelanto Semanal (1 semana) - Monto: $50,000.00",
  "createdAt": "2026-03-02T14:30:00.000Z",
  "updatedAt": "2026-03-02T14:30:00.000Z"
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Fase 1: Base de Datos** ✅
- [ ] Ejecutar Script 1: Verificar tabla
- [ ] Ejecutar Script 2: Campo `es_adelanto`
- [ ] Ejecutar Script 3: Campo `periodo_adelanto`
- [ ] Ejecutar Script 4: Campo `estado_adelanto`
- [ ] Ejecutar Script 5: Campo `saldo_adelanto_por_descontar`
- [ ] Ejecutar Script 6: Campo `monto_original_adelanto`
- [ ] Ejecutar Script 7: Campo `descuento_adelantos`
- [ ] Ejecutar Script 8: Campo `adelantos_aplicados_ids`
- [ ] Ejecutar Script 9: Campo `semana_referencia`
- [ ] Ejecutar Script 10: Modificar enum `tipo_pago`
- [ ] Ejecutar Script 11: Verificación final
- [ ] Ejecutar Script 12: Datos de prueba (opcional)

### **Fase 2: Endpoints** 🔄
- [ ] Modificar POST `/api/v1/pagos-profesional-obra` para adelantos
- [ ] Implementar lógica de descuento automático en POST
- [ ] Modificar GET para incluir campos de adelantos
- [ ] Crear PUT `/cancelar-adelanto`
- [ ] Crear GET `/adelantos/resumen`

### **Fase 3: Validaciones** ⏳
- [ ] Validar saldo disponible al crear adelanto
- [ ] Validar período de adelanto válido
- [ ] Validar que profesional existe y está activo
- [ ] Evitar adelantos duplicados en mismo período
- [ ] Validar permisos de empresa

### **Fase 4: Testing** ⏳
- [ ] Test: Crear adelanto válido
- [ ] Test: Rechazar adelanto que excede saldo
- [ ] Test: Descuento automático en pago regular
- [ ] Test: Múltiples adelantos activos
- [ ] Test: Cancelar adelanto
- [ ] Test: Listar adelantos activos

### **Fase 5: Documentación** ⏳
- [ ] Documentar API en Swagger/OpenAPI
- [ ] Crear guía de uso para usuarios finales
- [ ] Documentar casos edge y soluciones

---

## 🔗 RECURSOS ADICIONALES

### **Documentos Frontend:**
- [SISTEMA-ADELANTOS-README.md](SISTEMA-ADELANTOS-README.md) - Documentación técnica frontend
- [GUIA-RAPIDA-ADELANTOS.md](GUIA-RAPIDA-ADELANTOS.md) - Guía de usuario
- [src/services/adelantosService.js](src/services/adelantosService.js) - Servicio completo
- [src/components/DarAdelantoModal.jsx](src/components/DarAdelantoModal.jsx) - Componente UI

### **Endpoints Relacionados:**
- `/api/v1/pagos-profesional-obra` - Gestión de pagos
- `/api/v1/profesionales-obra` - Profesionales asignados
- `/api/v1/empresas` - Empresas/multitenant

---

## 📞 CONTACTO Y SOPORTE

Para dudas o aclaraciones durante la implementación:
- Frontend: Ya implementado y funcional
- Backend: Pendiente según esta especificación
- Testing: Coordinado entre ambos equipos

---

**FIN DEL DOCUMENTO**

**Próximo paso:** Ejecutar **SCRIPT 1** para verificar la estructura actual de la tabla.
