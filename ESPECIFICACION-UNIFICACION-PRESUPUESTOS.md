# 📋 ESPECIFICACIÓN: Unificación de 4 Tipos de Presupuestos

**Fecha:** 26/02/2026  
**Versión:** 1.0  
**Para:** Equipo Backend

---

## 🎯 OBJETIVO

Unificar **4 flujos diferentes** en una sola tabla `presupuestos_no_cliente` con un campo `tipo_presupuesto`.

### **Situación Actual (ANTES)**

| Flujo | Tabla BD | Endpoint | Servicio Frontend |
|-------|----------|----------|-------------------|
| Presupuesto Tradicional | `presupuestos_no_cliente` | `/api/v1/presupuestos-no-cliente` | `api.presupuestosNoCliente` |
| Trabajo Diario / Obra Rápida | `obras` (borrador) | `/api/obras/borrador` | `api.obras.create` |
| Trabajo Extra / Adicional Obra | `trabajos_extra` | `/api/v1/trabajos-extra` | `trabajosExtraService` |
| Tarea Leve / Trabajo Adicional | (varios endpoints) | `/api/trabajos-adicionales` | `trabajosAdicionalesService` |

**Problema:** Código duplicado, lógica compleja, difícil mantenimiento.

### **Situación Deseada (DESPUÉS)**

| Tipo | Misma Tabla | Mismo Endpoint Base | Mismo Servicio |
|------|-------------|---------------------|----------------|
| **TRADICIONAL** | `presupuestos_no_cliente` | `/api/v1/presupuestos-no-cliente` | `api.presupuestosNoCliente` |
| **TRABAJO_DIARIO** | `presupuestos_no_cliente` | `/api/v1/presupuestos-no-cliente` | `api.presupuestosNoCliente` |
| **TRABAJO_EXTRA** | `presupuestos_no_cliente` | `/api/v1/presupuestos-no-cliente` | `api.presupuestosNoCliente` |
| **TAREA_LEVE** | `presupuestos_no_cliente` | `/api/v1/presupuestos-no-cliente` | `api.presupuestosNoCliente` |

---

## 📊 CAMBIOS EN BASE DE DATOS

### **1. Agregar columna `tipo_presupuesto`**

```sql
-- Agregar nueva columna
ALTER TABLE presupuestos_no_cliente 
ADD COLUMN tipo_presupuesto VARCHAR(50) DEFAULT 'TRADICIONAL';

-- Crear índice para mejor performance
CREATE INDEX idx_tipo_presupuesto ON presupuestos_no_cliente(tipo_presupuesto);

-- Valores permitidos (usar ENUM o CHECK constraint según DB)
ALTER TABLE presupuestos_no_cliente
ADD CONSTRAINT chk_tipo_presupuesto 
CHECK (tipo_presupuesto IN ('TRADICIONAL', 'TRABAJO_DIARIO', 'TRABAJO_EXTRA', 'TAREA_LEVE'));
```

### **2. Agregar columna `trabajo_extra_id`** (para jerarquía)

```sql
-- Para vincular TAREA_LEVE a TRABAJO_EXTRA (cuando es "nieta")
ALTER TABLE presupuestos_no_cliente
ADD COLUMN trabajo_extra_id BIGINT NULL;

-- Foreign key opcional (si existe presupuesto padre)
ALTER TABLE presupuestos_no_cliente
ADD CONSTRAINT fk_trabajo_extra
FOREIGN KEY (trabajo_extra_id) 
REFERENCES presupuestos_no_cliente(id) 
ON DELETE SET NULL;

-- Índice para consultas
CREATE INDEX idx_trabajo_extra_id ON presupuestos_no_cliente(trabajo_extra_id);
```

### **3. Migrar datos existentes**

```sql
-- Actualizar registros actuales según es_presupuesto_trabajo_extra
UPDATE presupuestos_no_cliente 
SET tipo_presupuesto = CASE 
  WHEN es_presupuesto_trabajo_extra = true THEN 'TRABAJO_EXTRA'
  ELSE 'TRADICIONAL'
END;

-- Migrar trabajos adicionales (si existen en otra tabla)
-- NOTA: Coordinar con backend cómo migrar desde tabla trabajos_adicionales
INSERT INTO presupuestos_no_cliente (
  tipo_presupuesto,
  obra_id,
  trabajo_extra_id,
  nombre_obra,
  importe,
  estado,
  fecha_probable_inicio,
  empresa_id,
  ...
)
SELECT 
  'TAREA_LEVE' as tipo_presupuesto,
  ta.obra_id,
  ta.trabajo_extra_id,
  ta.nombre,
  ta.importe,
  ta.estado,
  ta.fecha_inicio,
  ta.empresa_id,
  ...
FROM trabajos_adicionales ta;

-- Verificar migración
SELECT tipo_presupuesto, COUNT(*) 
FROM presupuestos_no_cliente 
GROUP BY tipo_presupuesto;
```

---

## 🔗 JERARQUÍA Y VINCULACIÓN

### **Estructura de Árbol**

```
📊 PRESUPUESTO TRADICIONAL (id=100, tipo='TRADICIONAL')
│   └─ obra_id: NULL (hasta que se aprueba)
│   └─ trabajo_extra_id: NULL
│   └─ Al aprobar → genera obra_id=50
│
└─── 🏗️ OBRA (id=50)
     │
     ├─── 🔧 TRABAJO_EXTRA (id=101, tipo='TRABAJO_EXTRA')
     │    └─ obra_id: 50  ← vinculado a obra padre
     │    └─ trabajo_extra_id: NULL
     │    │
     │    └─── 📋 TAREA_LEVE (id=102, tipo='TAREA_LEVE')
     │         └─ obra_id: 50  ← heredado
     │         └─ trabajo_extra_id: 101  ← padre directo (NIETA)
     │
     └─── 📋 TAREA_LEVE (id=103, tipo='TAREA_LEVE')
          └─ obra_id: 50  ← vinculado a obra padre
          └─ trabajo_extra_id: NULL (HIJA directa)

📅 PRESUPUESTO TRABAJO_DIARIO (id=200, tipo='TRABAJO_DIARIO')
    └─ obra_id: NULL (hasta aprobarse)
    └─ Auto-aprueba → genera obra_id=60
    └─ Cliente auto-generado desde dirección
```

### **Reglas de Vinculación**

| Tipo | obra_id | trabajo_extra_id | Estado Inicial | Genera Obra |
|------|---------|------------------|----------------|-------------|
| **TRADICIONAL** | NULL → asignado al aprobar | NULL | BORRADOR | ✅ SÍ |
| **TRABAJO_DIARIO** | NULL → asignado al aprobar | NULL | APROBADO (auto) | ✅ SÍ |
| **TRABAJO_EXTRA** | OBLIGATORIO (existente) | NULL | BORRADOR | ❌ NO |
| **TAREA_LEVE** | OBLIGATORIO (heredado) | NULL o ID padre | APROBADO (auto) | ❌ NO |

---

## 📡 CAMBIOS EN ENDPOINTS (Backend)

### **Endpoint Principal (sin cambios)**

```
GET    /api/v1/presupuestos-no-cliente?empresaId=X&tipo=TRADICIONAL
POST   /api/v1/presupuestos-no-cliente
PUT    /api/v1/presupuestos-no-cliente/{id}
DELETE /api/v1/presupuestos-no-cliente/{id}
PATCH  /api/v1/presupuestos-no-cliente/{id}/estado
```

### **Nuevos Filtros**

```javascript
// Filtrar por tipo
GET /api/v1/presupuestos-no-cliente?tipo=TAREA_LEVE

// Filtrar hijos de una obra
GET /api/v1/presupuestos-no-cliente?obraId=50&tipo=TRABAJO_EXTRA

// Filtrar nietos de un trabajo extra
GET /api/v1/presupuestos-no-cliente?trabajoExtraId=101

// Filtrar solo padres
GET /api/v1/presupuestos-no-cliente?soloRaices=true
```

### **Lógica de Auto-Aprobación**

```java
@PostMapping("/api/v1/presupuestos-no-cliente")
public ResponseEntity<PresupuestoNoClienteDTO> crear(@RequestBody PresupuestoDTO dto) {
    
    // Auto-aprobar según tipo
    if (dto.getTipoPresupuesto() == TipoPresupuesto.TRABAJO_DIARIO ||
        dto.getTipoPresupuesto() == TipoPresupuesto.TAREA_LEVE) {
        dto.setEstado("APROBADO");
    }
    
    // Si es TRABAJO_DIARIO, crear obra inmediatamente
    if (dto.getTipoPresupuesto() == TipoPresupuesto.TRABAJO_DIARIO) {
        Obra obra = crearObraDesdePresupuesto(dto);
        dto.setObraId(obra.getId());
        
        // Auto-generar cliente desde dirección
        if (dto.getClienteId() == null) {
            Cliente cliente = crearClienteAutomatico(dto);
            dto.setClienteId(cliente.getId());
        }
    }
    
    // Validar vinculación según tipo
    if (dto.getTipoPresupuesto() == TipoPresupuesto.TRABAJO_EXTRA ||
        dto.getTipoPresupuesto() == TipoPresupuesto.TAREA_LEVE) {
        if (dto.getObraId() == null) {
            throw new ValidationException("Obra es obligatoria para " + dto.getTipoPresupuesto());
        }
    }
    
    return presupuestoService.crear(dto);
}
```

---

## 🎨 CAMBIOS EN FRONTEND

### **1. Eliminar servicios duplicados**

```javascript
// ❌ ELIMINAR
import * as trabajosAdicionalesService from '../services/trabajosAdicionalesService';

// ✅ USAR
import api from '../services/api';
import { TIPOS_PRESUPUESTO } from '../constants/presupuestoTypes';
```

### **2. Unificar llamados API**

```javascript
// ❌ ANTES: Código duplicado
await trabajosAdicionalesService.crearTrabajoAdicional({ ... });
await api.obras.create({ ... });
await api.trabajosExtra.create({ ... });

// ✅ DESPUÉS: Un solo método
await api.presupuestosNoCliente.create({
  tipoPresupuesto: TIPOS_PRESUPUESTO.TAREA_LEVE,
  obraId: obraId,
  trabajoExtraId: trabajoExtraId || null,
  ...datos
});
```

### **3. Componente Modal Unificado**

```jsx
// Un solo modal que cambia según tipo
<ModalPresupuesto 
  tipo={TIPOS_PRESUPUESTO.TAREA_LEVE}
  contexto={{
    obraId: 50,
    trabajoExtraId: null // o 101 si es nieta
  }}
  onGuardar={handleGuardar}
/>
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Backend**
- [ ] Agregar columna `tipo_presupuesto` en `presupuestos_no_cliente`
- [ ] Agregar columna `trabajo_extra_id` en `presupuestos_no_cliente`
- [ ] Crear ENUM `TipoPresupuesto` con 4 valores
- [ ] Migrar datos existentes
- [ ] Implementar lógica auto-aprobación (TRABAJO_DIARIO, TAREA_LEVE)
- [ ] Implementar creación automática de obra (TRABAJO_DIARIO)
- [ ] Implementar creación automática de cliente (TRABAJO_DIARIO)
- [ ] Agregar filtros: `tipo`, `trabajoExtraId`, `soloRaices`
- [ ] Actualizar validaciones según tipo
- [ ] Actualizar DTOs con nuevos campos

### **Frontend**
- [x] Crear `constants/presupuestoTypes.js`
- [ ] Eliminar `services/trabajosAdicionalesService.js`
- [ ] Refactorizar modal "Nueva Tarea Leve" → usar presupuestosNoCliente
- [ ] Refactorizar modal "Trabajo Diario" → usar presupuestosNoCliente
- [ ] Actualizar ObrasPage - eliminar referencias a trabajosAdicionales
- [ ] Actualizar PresupuestosNoClientePage - mostrar 4 tipos con badges
- [ ] Crear componente `ModalPresupuestoUnificado`
- [ ] Actualizar consultas para usar filtro `tipo`
- [ ] Pruebas de vinculación (hija/nieta)

---

## 🚀 PLAN DE MIGRACIÓN

### **Fase 1: Backend**
1. Crear columnas nuevas
2. Migrar datos existentes
3. Desplegar en desarrollo

### **Fase 2: Frontend**
1. Crear constantes y helpers
2. Refactorizar ObrasPage
3. Pruebas en desarrollo

### **Fase 3: Limpieza**
1. Eliminar tabla `trabajos_adicionales` (si existe)
2. Eliminar endpoints antiguos
3. Eliminar servicios frontend antiguos

### **Fase 4: Producción**
1. Backup completo
2. Ejecutar migración
3. Verificar datos
4. Desplegar versión nueva

---

## 📞 CONTACTO

**Preguntas sobre esta especificación:**
- Frontend: [Tu nombre]
- Backend: [Coordinar]

**Documentación relacionada:**
- [ESPECIFICACION-TRABAJOS-EXTRA-BACKEND.md](./ESPECIFICACION-TRABAJOS-EXTRA-BACKEND.md)
- [constants/presupuestoTypes.js](./src/constants/presupuestoTypes.js)
