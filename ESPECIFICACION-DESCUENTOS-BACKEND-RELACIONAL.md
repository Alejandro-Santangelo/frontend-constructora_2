# 📋 Especificación Backend: Descuentos en Modelo Relacional

## 📅 Fecha de Cambio
**19 de febrero de 2026**

## 🎯 Objetivo
Migrar la configuración de descuentos de **columna JSON (`descuentos_config`)** a **columnas relacionales** individuales, siguiendo el mismo patrón que `honorarios_*` y `mayores_costos_*`.

---

## 🗄️ Cambios en Base de Datos

### ❌ ELIMINAR
```sql
-- Eliminar columna JSON existente
ALTER TABLE presupuestos_no_cliente 
DROP COLUMN IF EXISTS descuentos_config;
```

### ✅ AGREGAR Nuevas Columnas Relacionales

```sql
-- Agregar nuevas columnas relacionales para descuentos
ALTER TABLE presupuestos_no_cliente

  -- 📝 Explicación general de los descuentos
  ADD COLUMN descuentos_explicacion TEXT,

  -- 🔨 Descuentos sobre JORNALES
  ADD COLUMN descuentos_jornales_activo BOOLEAN DEFAULT FALSE,
  ADD COLUMN descuentos_jornales_tipo VARCHAR(20) DEFAULT 'porcentaje',
  ADD COLUMN descuentos_jornales_valor NUMERIC(15,2) DEFAULT 0,

  -- 🧱 Descuentos sobre MATERIALES
  ADD COLUMN descuentos_materiales_activo BOOLEAN DEFAULT FALSE,
  ADD COLUMN descuentos_materiales_tipo VARCHAR(20) DEFAULT 'porcentaje',
  ADD COLUMN descuentos_materiales_valor NUMERIC(15,2) DEFAULT 0,

  -- 👨‍💼 Descuentos sobre HONORARIOS
  ADD COLUMN descuentos_honorarios_activo BOOLEAN DEFAULT FALSE,
  ADD COLUMN descuentos_honorarios_tipo VARCHAR(20) DEFAULT 'porcentaje',
  ADD COLUMN descuentos_honorarios_valor NUMERIC(15,2) DEFAULT 0,

  -- 📊 Descuentos sobre MAYORES COSTOS
  ADD COLUMN descuentos_mayores_costos_activo BOOLEAN DEFAULT FALSE,
  ADD COLUMN descuentos_mayores_costos_tipo VARCHAR(20) DEFAULT 'porcentaje',
  ADD COLUMN descuentos_mayores_costos_valor NUMERIC(15,2) DEFAULT 0;
```

### 📊 Tipos de Datos

| Campo | Tipo | Valores Permitidos | Descripción |
|-------|------|-------------------|-------------|
| `descuentos_explicacion` | `TEXT` | Texto libre | Explicación del por qué se aplican descuentos |
| `descuentos_*_activo` | `BOOLEAN` | `true`/`false` | Si el descuento está activado para esa categoría |
| `descuentos_*_tipo` | `VARCHAR(20)` | `'porcentaje'`/`'importe'` | Tipo de descuento (porcentaje o monto fijo) |
| `descuentos_*_valor` | `NUMERIC(15,2)` | Número decimal | Valor del descuento (% o importe según tipo) |

---

## ☕ Cambios en Backend Java

### 1️⃣ DTO: `PresupuestoNoClienteDTO.java`

```java
public class PresupuestoNoClienteDTO {
    
    // ... campos existentes ...

    // 💸 DESCUENTOS - Campos relacionales (igual que honorarios y mayoresCostos)
    
    // Explicación general
    private String descuentosExplicacion;
    
    // Jornales
    private Boolean descuentosJornalesActivo;
    private String descuentosJornalesTipo;  // "porcentaje" o "importe"
    private BigDecimal descuentosJornalesValor;
    
    // Materiales
    private Boolean descuentosMaterialesActivo;
    private String descuentosMaterialesTipo;
    private BigDecimal descuentosMaterialesValor;
    
    // Honorarios
    private Boolean descuentosHonorariosActivo;
    private String descuentosHonorariosTipo;
    private BigDecimal descuentosHonorariosValor;
    
    // Mayores Costos
    private Boolean descuentosMayoresCostosActivo;
    private String descuentosMayoresCostosTipo;
    private BigDecimal descuentosMayoresCostosValor;
    
    // ... getters y setters para todos los campos ...
}
```

### 2️⃣ Entity: `PresupuestoNoCliente.java`

```java
@Entity
@Table(name = "presupuestos_no_cliente")
public class PresupuestoNoCliente {
    
    // ... campos existentes ...

    // 💸 DESCUENTOS
    
    @Column(name = "descuentos_explicacion", columnDefinition = "TEXT")
    private String descuentosExplicacion;
    
    // Jornales
    @Column(name = "descuentos_jornales_activo")
    private Boolean descuentosJornalesActivo;
    
    @Column(name = "descuentos_jornales_tipo", length = 20)
    private String descuentosJornalesTipo;
    
    @Column(name = "descuentos_jornales_valor", precision = 15, scale = 2)
    private BigDecimal descuentosJornalesValor;
    
    // Materiales
    @Column(name = "descuentos_materiales_activo")
    private Boolean descuentosMaterialesActivo;
    
    @Column(name = "descuentos_materiales_tipo", length = 20)
    private String descuentosMaterialesTipo;
    
    @Column(name = "descuentos_materiales_valor", precision = 15, scale = 2)
    private BigDecimal descuentosMaterialesValor;
    
    // Honorarios
    @Column(name = "descuentos_honorarios_activo")
    private Boolean descuentosHonorariosActivo;
    
    @Column(name = "descuentos_honorarios_tipo", length = 20)
    private String descuentosHonorariosTipo;
    
    @Column(name = "descuentos_honorarios_valor", precision = 15, scale = 2)
    private BigDecimal descuentosHonorariosValor;
    
    // Mayores Costos
    @Column(name = "descuentos_mayores_costos_activo")
    private Boolean descuentosMayoresCostosActivo;
    
    @Column(name = "descuentos_mayores_costos_tipo", length = 20)
    private String descuentosMayoresCostosTipo;
    
    @Column(name = "descuentos_mayores_costos_valor", precision = 15, scale = 2)
    private BigDecimal descuentosMayoresCostosValor;
    
    // ... getters y setters ...
}
```

### 3️⃣ Mapper: Actualizar mapeos

```java
// En el mapper de Entity → DTO
dto.setDescuentosExplicacion(entity.getDescuentosExplicacion());

dto.setDescuentosJornalesActivo(entity.getDescuentosJornalesActivo());
dto.setDescuentosJornalesTipo(entity.getDescuentosJornalesTipo());
dto.setDescuentosJornalesValor(entity.getDescuentosJornalesValor());

dto.setDescuentosMaterialesActivo(entity.getDescuentosMaterialesActivo());
dto.setDescuentosMaterialesTipo(entity.getDescuentosMaterialesTipo());
dto.setDescuentosMaterialesValor(entity.getDescuentosMaterialesValor());

dto.setDescuentosHonorariosActivo(entity.getDescuentosHonorariosActivo());
dto.setDescuentosHonorariosTipo(entity.getDescuentosHonorariosTipo());
dto.setDescuentosHonorariosValor(entity.getDescuentosHonorariosValor());

dto.setDescuentosMayoresCostosActivo(entity.getDescuentosMayoresCostosActivo());
dto.setDescuentosMayoresCostosTipo(entity.getDescuentosMayoresCostosTipo());
dto.setDescuentosMayoresCostosValor(entity.getDescuentosMayoresCostosValor());

// En el mapper de DTO → Entity (mismo patrón inverso)
```

---

## 📤 Estructura de Request (desde Frontend)

El frontend ahora envía los descuentos como **campos separados** en el JSON:

```json
{
  "numeroPresupuesto": 4,
  "estado": "BORRADOR",
  "descuentosExplicacion": "Descuento especial por cliente frecuente",
  
  "descuentosJornalesActivo": true,
  "descuentosJornalesTipo": "porcentaje",
  "descuentosJornalesValor": 10.00,
  
  "descuentosMaterialesActivo": true,
  "descuentosMaterialesTipo": "porcentaje",
  "descuentosMaterialesValor": 5.00,
  
  "descuentosHonorariosActivo": true,
  "descuentosHonorariosTipo": "porcentaje",
  "descuentosHonorariosValor": 8.00,
  
  "descuentosMayoresCostosActivo": false,
  "descuentosMayoresCostosTipo": "porcentaje",
  "descuentosMayoresCostosValor": 0.00
}
```

---

## 📥 Estructura de Response (hacia Frontend)

El backend debe devolver los descuentos como **campos separados**:

```json
{
  "id": 21,
  "numeroPresupuesto": 4,
  "estado": "APROBADO",
  
  "descuentosExplicacion": "Descuento especial por cliente frecuente",
  
  "descuentosJornalesActivo": true,
  "descuentosJornalesTipo": "porcentaje",
  "descuentosJornalesValor": 10.00,
  
  "descuentosMaterialesActivo": true,
  "descuentosMaterialesTipo": "porcentaje",
  "descuentosMaterialesValor": 5.00,
  
  "descuentosHonorariosActivo": true,
  "descuentosHonorariosTipo": "porcentaje",
  "descuentosHonorariosValor": 8.00,
  
  "descuentosMayoresCostosActivo": false,
  "descuentosMayoresCostosTipo": "porcentaje",
  "descuentosMayoresCostosValor": 0.00,
  
  "totalPresupuesto": 50000000.00,
  "totalGeneral": 45000000.00
}
```

---

## 🔄 Migración de Datos Existentes

Si ya existen presupuestos con `descuentos_config` en formato JSON, ejecutar este script de migración:

```sql
-- Script de migración de descuentos_config (JSON) a columnas relacionales
UPDATE presupuestos_no_cliente
SET
  descuentos_explicacion = (descuentos_config::jsonb->>'explicacion'),
  
  descuentos_jornales_activo = COALESCE((descuentos_config::jsonb->'jornales'->>'activo')::boolean, false),
  descuentos_jornales_tipo = COALESCE((descuentos_config::jsonb->'jornales'->>'tipo'), 'porcentaje'),
  descuentos_jornales_valor = COALESCE((descuentos_config::jsonb->'jornales'->>'valor')::numeric, 0),
  
  descuentos_materiales_activo = COALESCE((descuentos_config::jsonb->'materiales'->>'activo')::boolean, false),
  descuentos_materiales_tipo = COALESCE((descuentos_config::jsonb->'materiales'->>'tipo'), 'porcentaje'),
  descuentos_materiales_valor = COALESCE((descuentos_config::jsonb->'materiales'->>'valor')::numeric, 0),
  
  descuentos_honorarios_activo = COALESCE((descuentos_config::jsonb->'honorarios'->>'activo')::boolean, false),
  descuentos_honorarios_tipo = COALESCE((descuentos_config::jsonb->'honorarios'->>'tipo'), 'porcentaje'),
  descuentos_honorarios_valor = COALESCE((descuentos_config::jsonb->'honorarios'->>'valor')::numeric, 0),
  
  descuentos_mayores_costos_activo = COALESCE((descuentos_config::jsonb->'mayoresCostos'->>'activo')::boolean, false),
  descuentos_mayores_costos_tipo = COALESCE((descuentos_config::jsonb->'mayoresCostos'->>'tipo'), 'porcentaje'),
  descuentos_mayores_costos_valor = COALESCE((descuentos_config::jsonb->'mayoresCostos'->>'valor')::numeric, 0)
WHERE descuentos_config IS NOT NULL;

-- Después de verificar que los datos se migraron correctamente:
-- ALTER TABLE presupuestos_no_cliente DROP COLUMN descuentos_config;
```

---

## ✅ Checklist de Implementación

- [ ] Crear nuevas columnas en la tabla `presupuestos_no_cliente`
- [ ] Migrar datos existentes de JSON a columnas relacionales
- [ ] Actualizar `PresupuestoNoClienteDTO.java` con nuevos campos
- [ ] Actualizar `PresupuestoNoCliente.java` (Entity) con nuevos campos
- [ ] Actualizar mappers (Entity ↔ DTO)
- [ ] Probar endpoints:
  - [ ] `POST /api/v1/presupuestos-no-cliente` (crear)
  - [ ] `PUT /api/v1/presupuestos-no-cliente/{id}` (actualizar)
  - [ ] `GET /api/v1/presupuestos-no-cliente/{id}` (obtener uno)
  - [ ] `GET /api/v1/presupuestos-no-cliente?empresaId={id}` (listar todos)
- [ ] Eliminar columna JSON antigua `descuentos_config` si todo funciona correctamente
- [ ] Eliminar código Java relacionado con `descuentosConfig` (si existía)

---

## 🎯 Beneficios del Cambio

1. **✅ Normalización**: Base de datos relacional pura, sin JSON
2. **🔍 Consultas SQL**: Posibilidad de filtrar por descuentos en queries
3. **📊 Índices**: Se pueden crear índices en campos específicos si es necesario
4. **🔒 Constraints**: Validaciones a nivel de base de datos
5. **📈 Consistencia**: Mismo patrón que honorarios y mayores costos

---

## 📞 Notas Importantes

- Los campos `*_tipo` solo aceptan: `"porcentaje"` o `"importe"`
- Todos los campos `*_valor` son `NUMERIC(15,2)` para soportar decimales
- Si `*_activo` es `false`, el valor se ignora en cálculos (pero se guarda)
- La `explicacion` es opcional pero recomendada para auditoría

---

**Frontend actualizado:** ✅ Completado (19/02/2026)  
**Backend pendiente:** ⏳ Implementar según esta especificación
