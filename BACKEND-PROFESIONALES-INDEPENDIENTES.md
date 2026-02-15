# 📋 Especificación de Implementación Backend
## Categorización de Profesionales: INDEPENDIENTES

---

## 🎯 Objetivo

Permitir que los profesionales creados manualmente (ad-hoc) puedan ser guardados en el catálogo permanente con la categoría `INDEPENDIENTE`, quedando disponibles para futuras asignaciones.

---

## 📊 1. BASE DE DATOS

### 1.1 Migración - Agregar Columna `categoria`

**Tabla:** `profesionales`

**SQL de Migración:**

```sql
-- Agregar columna categoria
ALTER TABLE profesionales 
ADD COLUMN categoria VARCHAR(20) DEFAULT 'EMPLEADO' AFTER activo;

-- Actualizar registros existentes (por si acaso)
UPDATE profesionales 
SET categoria = 'EMPLEADO' 
WHERE categoria IS NULL;

-- Índice para mejorar performance en queries filtradas
CREATE INDEX idx_profesionales_categoria ON profesionales(categoria);

-- Validación (opcional pero recomendada)
ALTER TABLE profesionales 
ADD CONSTRAINT chk_categoria 
CHECK (categoria IN ('EMPLEADO', 'INDEPENDIENTE', 'CONTRATISTA'));
```

### 1.2 Valores Permitidos

| Categoría | Descripción | Uso |
|-----------|-------------|-----|
| `EMPLEADO` | **Default** - Profesionales contratados directamente por la empresa | Personal permanente/planilla |
| `INDEPENDIENTE` | Profesionales externos creados ad-hoc para asignaciones temporales | Autónomos, freelancers |
| `CONTRATISTA` | *(Futuro)* Empresas contratistas o cooperativas | Outsourcing |

---

## 🔧 2. BACKEND - Modelo y Endpoints

### 2.1 Modelo Sequelize (Node.js)

**Archivo:** `models/Profesional.js` (o similar)

```javascript
module.exports = (sequelize, DataTypes) => {
  const Profesional = sequelize.define('Profesional', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    tipoProfesional: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    honorarioDia: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    empresaId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // 🆕 NUEVA COLUMNA
    categoria: {
      type: DataTypes.ENUM('EMPLEADO', 'INDEPENDIENTE', 'CONTRATISTA'),
      defaultValue: 'EMPLEADO',
      allowNull: false
    }
  }, {
    tableName: 'profesionales',
    timestamps: true
  });

  return Profesional;
};
```

### 2.2 Controlador - Crear Profesional

**Archivo:** `controllers/profesionalesController.js`

**Modificación en método `create`:**

```javascript
exports.create = async (req, res) => {
  try {
    const { 
      nombre, 
      tipoProfesional, 
      honorarioDia, 
      telefono, 
      email, 
      empresaId,
      categoria // 🆕 Recibir categoría desde frontend
    } = req.body;

    // Validaciones
    if (!nombre || !tipoProfesional || !empresaId) {
      return res.status(400).json({
        message: 'Nombre, tipo de profesional y empresaId son obligatorios'
      });
    }

    // Validar categoría si viene
    const categoriasValidas = ['EMPLEADO', 'INDEPENDIENTE', 'CONTRATISTA'];
    const categoriaFinal = categoria && categoriasValidas.includes(categoria) 
      ? categoria 
      : 'EMPLEADO';

    const nuevoProfesional = await Profesional.create({
      nombre: nombre.trim(),
      tipoProfesional: tipoProfesional.trim(),
      honorarioDia: honorarioDia || 0,
      telefono: telefono?.trim() || null,
      email: email?.trim() || null,
      empresaId,
      activo: true,
      categoria: categoriaFinal // 🆕 Guardar categoría
    });

    return res.status(201).json(nuevoProfesional);

  } catch (error) {
    console.error('Error al crear profesional:', error);
    return res.status(500).json({
      message: 'Error al crear profesional',
      error: error.message
    });
  }
};
```

### 2.3 Endpoint GET con Filtrado

**Ruta:** `GET /api/profesionales?empresaId=X&categoria=INDEPENDIENTE`

**Controlador:**

```javascript
exports.getAll = async (req, res) => {
  try {
    const { empresaId, categoria, activo } = req.query;

    // Construir filtros dinámicos
    const where = {};

    if (empresaId) {
      where.empresaId = empresaId;
    }

    if (categoria) {
      // Permitir filtrar por una o varias categorías
      if (Array.isArray(categoria)) {
        where.categoria = { [Op.in]: categoria };
      } else {
        where.categoria = categoria;
      }
    }

    if (activo !== undefined) {
      where.activo = activo === 'true' || activo === true;
    }

    const profesionales = await Profesional.findAll({
      where,
      order: [['nombre', 'ASC']]
    });

    return res.json(profesionales);

  } catch (error) {
    console.error('Error al obtener profesionales:', error);
    return res.status(500).json({
      message: 'Error al obtener profesionales',
      error: error.message
    });
  }
};
```

### 2.4 Ruta Express

**Archivo:** `routes/profesionales.js`

```javascript
const express = require('express');
const router = express.Router();
const profesionalesController = require('../controllers/profesionalesController');

// Listar profesionales (con filtros opcionales)
router.get('/', profesionalesController.getAll);

// Crear profesional
router.post('/', profesionalesController.create);

// Obtener por ID
router.get('/:id', profesionalesController.getById);

// Actualizar
router.put('/:id', profesionalesController.update);

// Eliminar (soft delete)
router.delete('/:id', profesionalesController.delete);

module.exports = router;
```

---

## 💻 3. FRONTEND - Estructura de Request

### 3.1 Ubicaciones Implementadas

La funcionalidad de guardar profesionales independientes está disponible en **DOS lugares**:

1. **Modal de Selección de Profesionales** (`SeleccionarProfesionalesModal.jsx`)
   - Usado en: Configuración de planificación de obras
   - Tab: "Agregar Manualmente"
   - Checkbox: "Guardar en catálogo permanente"

2. **Modal de Trabajos Adicionales** (`ObrasPage.jsx`)
   - Usado en: Creación/edición de trabajos adicionales
   - Tab: "Agregar Manualmente"  
   - Checkbox: "Guardar en catálogo permanente"

Ambas implementaciones funcionan de forma idéntica y comparten el mismo flujo.

### 3.2 Payload de Creación

**Endpoint:** `POST /api/profesionales`

**Body (JSON):**

```json
{
  "nombre": "Juan Pérez",
  "tipoProfesional": "Albañil",
  "honorarioDia": 15000,
  "telefono": "+54 9 11 1234-5678",
  "email": "juan.perez@ejemplo.com",
  "empresaId": 1,
  "categoria": "INDEPENDIENTE"
}
```

### 3.3 Response Esperado

**Status:** `201 Created`

**Body:**

```json
{
  "id": 42,
  "nombre": "Juan Pérez",
  "tipoProfesional": "Albañil",
  "honorarioDia": 15000.00,
  "telefono": "+54 9 11 1234-5678",
  "email": "juan.perez@ejemplo.com",
  "empresaId": 1,
  "activo": true,
  "categoria": "INDEPENDIENTE",
  "createdAt": "2026-02-15T10:30:00.000Z",
  "updatedAt": "2026-02-15T10:30:00.000Z"
}
```

### 3.4 Llamada desde Frontend

**Implementación 1: SeleccionarProfesionalesModal.jsx**

```javascript
const dataProfesional = {
  nombre: profesionalAdhocForm.nombre.trim(),
  tipoProfesional: profesionalAdhocForm.tipoProfesional.trim(),
  honorarioDia: profesionalAdhocForm.honorarioDia ? parseFloat(profesionalAdhocForm.honorarioDia) : 0,
  telefono: profesionalAdhocForm.telefono.trim() || null,
  email: profesionalAdhocForm.email.trim() || null,
  empresaId: empresaId,
  activo: true,
  categoria: 'INDEPENDIENTE'
};

const response = await apiService.profesionales.create(dataProfesional);
```

**Implementación 2: ObrasPage.jsx (Trabajos Adicionales)**

```javascript
const dataProfesional = {
  nombre: profesionalAdhocForm.nombre.trim(),
  tipoProfesional: profesionalAdhocForm.tipoProfesional.trim(),
  honorarioDia: profesionalAdhocForm.honorarioDia ? parseFloat(profesionalAdhocForm.honorarioDia) : 0,
  telefono: profesionalAdhocForm.telefono.trim() || null,
  email: profesionalAdhocForm.email.trim() || null,
  empresaId: empresaId,
  activo: true,
  categoria: 'INDEPENDIENTE'
};

const response = await api.profesionales.create(dataProfesional);

// Además actualiza la lista local de profesionales disponibles
setProfesionalesDisponiblesTA(prev => [...prev, nuevoProfesional]);
```

---

## 🧪 4. TESTING

### 4.1 Test de Migración

```sql
-- Verificar que la columna se creó
DESCRIBE profesionales;

-- Verificar valores default
SELECT id, nombre, categoria 
FROM profesionales 
LIMIT 5;

-- Verificar constraint (si se agregó)
INSERT INTO profesionales (nombre, tipoProfesional, empresaId, categoria) 
VALUES ('Test', 'Albañil', 1, 'INVALIDO'); -- Debe fallar
```

### 4.2 Test de API (Postman/Thunder Client)

**1. Crear Profesional INDEPENDIENTE**

```http
POST http://localhost:3000/api/profesionales
Content-Type: application/json

{
  "nombre": "Test Independiente",
  "tipoProfesional": "Electricista",
  "empresaId": 1,
  "categoria": "INDEPENDIENTE"
}
```

**Resultado esperado:** Status 201, objeto con `categoria: "INDEPENDIENTE"`

---

**2. Listar Solo Independientes**

```http
GET http://localhost:3000/api/profesionales?empresaId=1&categoria=INDEPENDIENTE
```

**Resultado esperado:** Array con solo profesionales de categoría INDEPENDIENTE

---

**3. Crear sin categoría (debe defaultear a EMPLEADO)**

```http
POST http://localhost:3000/api/profesionales
Content-Type: application/json

{
  "nombre": "Test Default",
  "tipoProfesional": "Plomero",
  "empresaId": 1
}
```

**Resultado esperado:** Status 201, objeto con `categoria: "EMPLEADO"`

---

## 📊 5. REPORTES Y CONSULTAS ÚTILES

### 5.1 Profesionales por Categoría

```sql
SELECT 
  categoria,
  COUNT(*) as cantidad,
  AVG(honorarioDia) as promedio_honorario
FROM profesionales
WHERE activo = 1
GROUP BY categoria;
```

### 5.2 Independientes Más Utilizados

```sql
SELECT 
  p.id,
  p.nombre,
  p.tipoProfesional,
  COUNT(po.id) as cantidad_asignaciones
FROM profesionales p
LEFT JOIN profesionales_obras po ON p.id = po.profesionalId
WHERE p.categoria = 'INDEPENDIENTE'
GROUP BY p.id
ORDER BY cantidad_asignaciones DESC
LIMIT 10;
```

---

## ⚠️ 6. CONSIDERACIONES IMPORTANTES

### 6.1 Migración de Datos Existentes

- Todos los profesionales actuales quedarán como `EMPLEADO` (valor default)
- Si se desea reclasificar algunos manualmente:

```sql
UPDATE profesionales 
SET categoria = 'INDEPENDIENTE'
WHERE id IN (12, 34, 56); -- IDs específicos
```

### 6.2 Validaciones Adicionales Opcionales

**En el Controller:**

```javascript
// Evitar duplicados de independientes con mismo nombre+tipo+empresa
const existente = await Profesional.findOne({
  where: {
    nombre: nombre.trim(),
    tipoProfesional: tipoProfesional.trim(),
    empresaId,
    activo: true
  }
});

if (existente) {
  return res.status(409).json({
    message: 'Ya existe un profesional con ese nombre y tipo',
    profesionalExistente: existente
  });
}
```

### 6.3 Retrocompatibilidad

- El campo `categoria` tiene default, por lo que **no rompe** código existente
- Endpoints actuales seguirán funcionando normalmente
- Los profesionales sin categoría explícita se tratarán como `EMPLEADO`

---

## 📅 7. PLAN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1: Base de Datos (30 min - 1 hora)

- [ ] Ejecutar migración SQL
- [ ] Verificar columna creada
- [ ] Probar constraint (si se implementa)
- [ ] Backup de BD antes de migrar

### Fase 2: Backend (2-3 horas)

- [ ] Actualizar modelo Sequelize
- [ ] Modificar controller `create` para aceptar categoría
- [ ] Modificar controller `getAll` para filtrar por categoría
- [ ] Agregar validaciones
- [ ] Testing manual con Postman

### Fase 3: Testing Integrado (1-2 horas)

- [ ] Probar creación de INDEPENDIENTE desde frontend
- [ ] Verificar que se guarda correctamente en BD
- [ ] Probar que aparece en listados
- [ ] Probar asignación a obras
- [ ] Verificar que profesionales existentes siguen funcionando

### Fase 4: Opcional - Mejoras (futuro)

- [ ] Endpoint específico `GET /api/profesionales/independientes`
- [ ] Filtros en UI para mostrar solo independientes/empleados
- [ ] Reportes de uso por categoría
- [ ] Badges de colores por categoría en listados

---

## 🔗 8. REFERENCIAS

**Archivos Frontend Modificados:**
- `src/components/SeleccionarProfesionalesModal.jsx` (líneas 1, 99-102, 313-397, 720-762, 780-795)
- `src/pages/ObrasPage.jsx` (líneas 163-172, 9283-9288, 9365-9477, 9535-9557) - Modal de Trabajos Adicionales

**API Service:**
- `src/services/api.js` (línea 755: `profesionales.create()`)

**Endpoint Backend:**
- `POST /api/profesionales`
- `GET /api/profesionales?categoria=INDEPENDIENTE`

---

## 📞 CONTACTO / SOPORTE

Para dudas sobre la implementación, contactar a:
- **Frontend:** Ya implementado ✅
- **Backend:** Pendiente de implementación según esta especificación

---

**Fecha de Creación:** 15 de febrero de 2026  
**Versión:** 1.0  
**Estado:** Frontend implementado - Backend pendiente
