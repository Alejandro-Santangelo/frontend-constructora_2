# 🎯 Integración del RubroSelector - Guía Completa

**Componente:** `RubroSelector.jsx`  
**Ubicación:** `src/components/RubroSelector.jsx`  
**Fecha:** 15 de marzo de 2026  

---

## 📋 Descripción

Componente selector de rubros con:
- ✅ Carga automática desde `/api/rubros`
- ✅ Agrupación por categorías (Estructura, Instalaciones, Terminaciones, etc.)
- ✅ Opción "Crear nuevo rubro personalizado"
- ✅ Validación para evitar duplicados
- ✅ Normalización automática de nombres
- ✅ Fallback a entrada manual si la API falla

---

## 🔧 Props del Componente

```typescript
interface RubroSelectorProps {
  value: string;                    // Valor actual (nombreRubro)
  onChange: (nombreRubro: string) => void;  // Callback al seleccionar
  placeholder?: string;             // Placeholder del select
  disabled?: boolean;               // Deshabilitar selector
  rubrosExistentesEnPresupuesto?: string[];  // Rubros ya usados (validación)
}
```

---

## 💡 Ejemplos de Uso

### 1. Uso Básico - Agregar Honorario por Rubro

```jsx
import RubroSelector from './RubroSelector';

function AgregarHonorarioForm() {
  const [nuevoHonorario, setNuevoHonorario] = useState({
    nombreRubro: '',
    profesionalesActivo: true,
    profesionalesValor: 10,
    // ... otros campos
  });

  return (
    <div>
      <label>Rubro *</label>
      <RubroSelector
        value={nuevoHonorario.nombreRubro}
        onChange={(nombreRubro) => 
          setNuevoHonorario(prev => ({ ...prev, nombreRubro }))
        }
        placeholder="Seleccione un rubro..."
      />
    </div>
  );
}
```

### 2. Con Validación de Duplicados

```jsx
function ConfiguracionPresupuestoSection({ honorarios }) {
  // Extraer rubros ya usados en el presupuesto
  const rubrosYaUsados = honorarios.map(h => h.nombreRubro);

  return (
    <RubroSelector
      value={nuevoRubro}
      onChange={setNuevoRubro}
      rubrosExistentesEnPresupuesto={rubrosYaUsados}
      placeholder="Seleccione rubro para honorarios..."
    />
  );
}
```

### 3. En Modal de Agregar Mayores Costos por Rubro

```jsx
function AgregarMayorCostoModal({ mayoresCostosActuales, onAgregar }) {
  const [form, setForm] = useState({
    nombreRubro: '',
    profesionalesActivo: true,
    profesionalesValor: 5,
    // ...
  });

  const rubrosUsados = mayoresCostosActuales.map(m => m.nombreRubro);

  const handleSubmit = () => {
    if (!form.nombreRubro) {
      alert('Debe seleccionar un rubro');
      return;
    }
    onAgregar(form);
  };

  return (
    <div className="modal">
      <h5>Agregar Mayor Costo por Rubro</h5>
      
      <div className="mb-3">
        <label>Rubro *</label>
        <RubroSelector
          value={form.nombreRubro}
          onChange={(nombreRubro) => 
            setForm(prev => ({ ...prev, nombreRubro }))
          }
          rubrosExistentesEnPresupuesto={rubrosUsados}
        />
      </div>

      {/* Resto del formulario... */}
      
      <button onClick={handleSubmit}>
        Agregar Mayor Costo
      </button>
    </div>
  );
}
```

### 4. En Descuentos por Rubro

```jsx
const AgregarDescuento = ({ descuentosActuales, onAgregar }) => {
  const [descuento, setDescuento] = useState({
    nombreRubro: '',
    profesionalesActivo: true,
    profesionalesTipo: 'porcentaje',
    profesionalesValor: 0,
    // ...
  });

  return (
    <form>
      <RubroSelector
        value={descuento.nombreRubro}
        onChange={(nombreRubro) => 
          setDescuento(prev => ({ ...prev, nombreRubro }))
        }
        rubrosExistentesEnPresupuesto={
          descuentosActuales.map(d => d.nombreRubro)
        }
        placeholder="Seleccione rubro para descuento..."
      />
    </form>
  );
};
```

---

## 🎨 Características del Selector

### Agrupación por Categorías
```
🏗️ Estructura
  ├─ Albañilería
  ├─ Cimientos
  ├─ Excavación
  └─ Herrería

🔌 Instalaciones
  ├─ Electricidad
  └─ Plomería

🎨 Terminaciones
  ├─ Pintura
  ├─ Pisos
  └─ Carpintería
```

### Opción Crear Nuevo
```
➕ Crear nuevo rubro personalizado...
─────────────────────────────────
Cuando el usuario selecciona esta opción, se muestra:

┌─────────────────────────────────┐
│ ✨ Crear Nuevo Rubro            │
│                                 │
│ Nombre del nuevo rubro *        │
│ [Ej: Carpintería Metálica...]  │
│                                 │
│ 💡 El rubro se creará          │
│    automáticamente al guardar   │
│                                 │
│ [✓ Usar Este Rubro]            │
└─────────────────────────────────┘
```

### Validaciones Automáticas

1. **Nombre vacío**
   ```
   ❌ "El nombre no puede estar vacío"
   ```

2. **Duplicado en maestro**
   ```
   ❌ "Ya existe un rubro con ese nombre. Selecciónelo de la lista."
   ```

3. **Duplicado en presupuesto actual**
   ```
   ❌ "Este rubro ya está agregado en el presupuesto actual"
   ```

4. **Longitud mínima**
   ```
   ❌ "El nombre debe tener al menos 3 caracteres"
   ```

5. **Longitud máxima**
   ```
   ❌ "El nombre no puede superar 100 caracteres"
   ```

---

## 🔄 Flujo de Trabajo

### Escenario 1: Usuario selecciona rubro existente
```
1. Usuario abre selector
2. Ve rubros agrupados por categoría
3. Selecciona "Albañilería"
4. onChange se dispara con "Albañilería"
5. Backend buscará/creará el rubro automáticamente
```

### Escenario 2: Usuario crea rubro nuevo
```
1. Usuario selecciona "➕ Crear nuevo rubro personalizado..."
2. Se muestra formulario de creación
3. Usuario escribe "Instalación de Gas Natural"
4. Validación: ✓ No existe, ✓ >3 caracteres
5. Usuario hace clic en "✓ Usar Este Rubro"
6. onChange se dispara con "Instalación De Gas Natural" (normalizado)
7. Backend crea automáticamente el rubro con categoría "personalizado"
```

### Escenario 3: Intento de duplicado
```
1. Presupuesto ya tiene honorarios para "Plomería"
2. Usuario intenta agregar otro mayor costo para "plomeria" (sin tilde)
3. Validación detecta duplicado (case-insensitive)
4. Se muestra error: "Este rubro ya está agregado en el presupuesto actual"
5. Usuario debe seleccionar otro rubro
```

---

## 📦 Integración en Formularios Existentes

### Reemplazar Input Manual por RubroSelector

**❌ ANTES (Input manual):**
```jsx
<input
  type="text"
  value={nombreRubro}
  onChange={(e) => setNombreRubro(e.target.value)}
  placeholder="Ingrese el nombre del rubro"
/>
```

**✅ AHORA (RubroSelector):**
```jsx
<RubroSelector
  value={nombreRubro}
  onChange={setNombreRubro}
  rubrosExistentesEnPresupuesto={rubrosYaAgregados}
/>
```

---

## 🐛 Manejo de Errores

### Si la API /api/rubros falla:
```jsx
// El componente automáticamente:
1. Muestra mensaje: "No se pudieron cargar los rubros. Se usará entrada manual."
2. Cambia a modoCreacion = true
3. Usuario puede ingresar manualmente el nombre
4. Backend creará el rubro al guardar
```

---

## 🎯 Beneficios vs Input Manual

| Característica | Input Manual | RubroSelector |
|---------------|--------------|---------------|
| Evita duplicados | ❌ | ✅ |
| Normalización | ❌ | ✅ (capitalización) |
| Categorización | ❌ | ✅ |
| Autocomplete | ❌ | ✅ (visual) |
| Validación | ❌ | ✅ (tiempo real) |
| Flexibilidad | ✅ | ✅ |
| UX | ⚠️ | ✅✅✅ |

---

## 🔍 Testing

### Test 1: Cargar rubros
```javascript
// Verificar que se cargan los 15 rubros estándar
expect(rubros.length).toBeGreaterThanOrEqual(15);
```

### Test 2: Validar duplicado
```javascript
const rubrosExistentes = ['Albañilería', 'Plomería'];
// Intentar agregar "albanileria" (sin tilde, minúsculas)
expect(validarNuevoRubro('albanileria')).toBe(false);
```

### Test 3: Crear rubro nuevo
```javascript
const nuevoRubro = '  carpintería metálica  ';
// Debe normalizar a "Carpintería Metálica"
expect(normalizarNombre(nuevoRubro)).toBe('Carpintería Metálica');
```

---

## 📝 Notas Importantes

1. **Sincronización Backend**: El rubro se crea en BD cuando se guarda el presupuesto, no cuando se selecciona
2. **Case-insensitive**: "plomeria" = "Plomería" = "PLOMERIA"
3. **Categoría por defecto**: Rubros nuevos tienen categoría "personalizado"
4. **Reutilizable**: Mismo componente para honorarios, mayores costos y descuentos
5. **Sin estado global**: No usa Redux/Context, es autónomo

---

## 🚀 Próximos Pasos

1. Integrar en `ConfiguracionPresupuestoSection.jsx`
2. Reemplazar inputs manuales existentes
3. Probar con datos reales
4. Ajustar estilos según diseño de la app
5. Agregar tests unitarios

---

## ❓ Preguntas Frecuentes

**P: ¿Qué pasa si creo "Plomeria" y ya existe "Plomería"?**  
R: El validador detecta que son iguales (case-insensitive) y sugiere usar el existente.

**P: ¿Puedo editar rubros después de crearlos?**  
R: Sí, desde el endpoint PUT /api/rubros/{id} (backend ya implementado).

**P: ¿Los rubros personalizados se guardan para todos los presupuestos?**  
R: Sí, quedan en la tabla `rubros` y están disponibles para todos.

**P: ¿Qué pasa si borro un rubro de la tabla rubros?**  
R: Los honorarios/mayores costos/descuentos mantienen el `nombreRubro` como backup (la columna no se borra, solo el FK se setea a NULL).

---

## 📞 Soporte

Si encuentras problemas:
1. Verificar que `/api/rubros` responde correctamente
2. Revisar consola del navegador para errores de red
3. Validar que `axios` está configurado con el baseURL correcto
4. Verificar que el endpoint tiene CORS habilitado

---

✅ **Componente listo para usar**. Integrar en formularios de presupuesto.
