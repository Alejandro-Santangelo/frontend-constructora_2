# ⚡ Quick Start - Primera Empresa

## 🎯 Inicio Rápido (3 pasos)

### 1️⃣ Iniciar el Backend
```bash
cd backend
./mvnw spring-boot:run
```

### 2️⃣ Iniciar el Frontend
```bash
cd frontend-rodrigo
npm run dev
```

### 3️⃣ Crear Primera Empresa
1. Abrir navegador → `http://localhost:5173`
2. Verás este mensaje:

```
┌─────────────────────────────────┐
│          📭                     │
│  No hay empresas registradas    │
│                                 │
│  [+ Crear Primera Empresa]      │
└─────────────────────────────────┘
```

3. Hacer clic en el botón
4. Completar:
   - ✅ **Nombre:** Tu Empresa Principal
   - ✅ **CUIT:** 20-12345678-9
   - 📝 Dirección: (opcional)
   - 📝 Teléfono: (opcional)
   - 📝 Email: (opcional)
   - 📝 Representante: (opcional)

5. Clic en "✓ Crear Empresa"

### ✅ ¡Listo!
Ahora puedes:
- Seleccionar tu empresa
- Acceder al sistema completo
- Crear clientes, obras, profesionales, etc.

---

## 🔧 Alternativa: Script SQL Rápido

Si prefieres SQL directo:

```sql
-- Copiar y ejecutar en PostgreSQL
INSERT INTO empresas (
    nombre_empresa,
    cuit,
    activa,
    fecha_creacion
) VALUES (
    'Mi Empresa Principal',
    '20-12345678-9',
    true,
    CURRENT_TIMESTAMP
);
```

Luego iniciar el frontend y seleccionar la empresa.

---

## 📖 Más Información

- Guía completa: [INICIALIZAR-BASE-DATOS.md](./INICIALIZAR-BASE-DATOS.md)
- Diagramas de flujo: [SOLUCION-MULTI-TENANT.md](./SOLUCION-MULTI-TENANT.md)
- Script SQL completo: [init-database.sql](./init-database.sql)

---

**¿Problemas?** Revisa que:
- Backend esté en puerto 8080 ✓
- Frontend esté en puerto 5173 ✓
- Base de datos esté activa ✓
