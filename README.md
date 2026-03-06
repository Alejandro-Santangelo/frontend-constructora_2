# 🚀 Frontend Rodrigo - Sistema de Gestión de Construcciones

Frontend profesional desarrollado con **Vite + React + Bootstrap** para la gestión integral de proyectos de construcción con arquitectura multi-tenant.

## ⚡ Inicio Rápido

### 🆕 Primer Setup (Nuevos Desarrolladores)

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>

# 2. Instalar dependencias
npm install

# 3. Configurar entorno de desarrollo (IMPORTANTE)
npm run setup

# 4. Iniciar desarrollo
npm run dev
```

**El script `npm run setup` configura automáticamente:**
- ✅ VS Code con UTF-8 como encoding predeterminado
- ✅ Git con normalización de líneas
- ✅ Extensiones necesarias (EditorConfig, ESLint, etc.)
- ✅ Verificación de archivos del proyecto

📖 **Más información:** Ver [SETUP-README.md](./SETUP-README.md)

### 🆕 ¿Primera vez? (Base de datos vacía)
Lee la [**Guía de Inicio Rápido (QUICK-START.md)**](./QUICK-START.md) para crear tu primera empresa en 3 pasos.

### 📚 Documentación Completa
- [⚡ Quick Start](./QUICK-START.md) - Inicio rápido en 3 pasos
- [🔧 Setup del Entorno](./SETUP-README.md) - Configuración automática para desarrolladores
- [📖 Inicializar Base de Datos](./INICIALIZAR-BASE-DATOS.md) - Guía paso a paso detallada
- [🏢 Solución Multi-Tenant](./SOLUCION-MULTI-TENANT.md) - Diagramas y arquitectura
- [💾 Script SQL](./init-database.sql) - Inicialización directa en base de datos

## 🏢 Sistema Multi-Tenant

Este sistema permite gestionar **múltiples empresas** (tenants) desde una sola aplicación:
- 🏗️ Empresa principal (constructora)
- 👥 Clientes (empresas cliente)
- 🏢 Obras específicas
- 📊 Datos completamente aislados por empresa

### Primera Ejecución

Cuando inicies la aplicación por primera vez con la base de datos vacía:

1. Se mostrará automáticamente un **modal de selección de empresa**
2. Verás el mensaje: "No hay empresas registradas"
3. Haz clic en **"Crear Primera Empresa"**
4. Completa el formulario con los datos de tu empresa principal
5. ¡Listo! Ya puedes acceder al sistema completo

## ✨ Características Principales

### � Gestión Multi-Empresa
- **Empresas**: Crear y administrar múltiples empresas/tenants
- **Selección Rápida**: Modal inteligente para cambiar entre empresas
- **Datos Aislados**: Cada empresa tiene sus propios datos completamente separados
- **Primera Configuración**: Asistente para crear la primera empresa sin complicaciones

### 🏗️ Gestión de Construcciones
- **Obras**: Control completo de proyectos de construcción
- **Clientes**: Administración de clientes y contactos
- **Profesionales**: Gestión de personal y roles
- **Asignaciones**: Control de personal asignado a obras

### 💰 Sistema Financiero
- **Presupuestos**: Creación y gestión de presupuestos
- **Caja Chica**: Control de gastos menores por obra
- **Pagos**: Registro de pagos a profesionales
- **Cobros**: Control de cobros por obra
- **Materiales**: Gestión de materiales y costos

### 📊 Control y Reportes
- **Dashboard**: Estadísticas en tiempo real por empresa
- **Asistencias**: Control de asistencia del personal
- **Estadísticas**: Reportes por obra y consolidados
- **Etapas**: Seguimiento de avance de obras

### 🎨 Interfaz Moderna
- Diseño responsivo con Bootstrap 5
- Múltiples vistas de datos (tabla, cards, JSON)
- Notificaciones en tiempo real
- Sidebar colapsable
- Modales intuitivos

## 🛠️ Tecnologías

- **⚡ Vite**: Build tool ultrarrápido
- **⚛️ React 18**: Framework moderno
- **🎨 Bootstrap 5**: Diseño responsivo
- **📡 Axios**: Cliente HTTP optimizado
- **🛣️ React Router**: Navegación SPA
- **🔄 Redux**: Gestión de estado global
- **📅 Date-fns**: Manejo de fechas

## 🚦 Instalación y Uso

### 1️⃣ Instalar dependencias
```bash
npm install
```

### 2️⃣ Configurar backend
Asegúrate de que tu backend esté ejecutándose en:
```
http://localhost:8080/api
```

### 3️⃣ Iniciar desarrollo
```bash
npm run dev
```

### 4️⃣ Abrir en navegador
```
http://localhost:5173
```

> 💡 **Primera vez:** Si la base de datos está vacía, sigue la [Guía de Inicio Rápido](./QUICK-START.md)

## 📁 Estructura del Proyecto

```
frontend-rodrigo/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Navbar.jsx      # Barra de navegación
│   │   ├── Sidebar.jsx     # Menú lateral
│   │   └── NotificationToast.jsx
│   ├── pages/              # Páginas principales
│   │   ├── Dashboard.jsx   # Panel principal
│   │   ├── CrudPage.jsx    # Gestión CRUD
│   │   └── ApiTester.jsx   # Probador de API
│   ├── services/           # Servicios
│   │   └── api.js          # Cliente API optimizado
│   ├── App.jsx             # Componente raíz
│   ├── main.jsx            # Punto de entrada
│   └── index.css           # Estilos globales
├── package.json            # Dependencias
├── vite.config.js          # Configuración Vite
└── index.html              # HTML base
```

## 🎮 Cómo Usar

### 📊 Dashboard
1. Ve estadísticas de tu backend
2. Prueba la conexión
3. Accede rápidamente a cualquier sección

### 👥 Gestión CRUD
1. Selecciona una entidad (Usuarios, Productos, etc.)
2. Ve todos los registros en formato tabla, cards o JSON
3. Crea nuevos registros con JSON
4. Edita registros existentes
5. Elimina registros con confirmación

### 🧪 API Tester
1. Selecciona el método HTTP
2. Ingresa el endpoint
3. Agrega cuerpo JSON (si es necesario)
4. ¡Ejecuta y ve resultados al instante!
5. Usa endpoints predefinidos para mayor rapidez

## ⚙️ Configuración

### Cambiar URL del Backend
Edita `src/services/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:8080/api'; // Cambia aquí
```

### Agregar Nuevos Endpoints
Edita `src/services/api.js` y agrega:
```javascript
tuEndpoint: {
  getAll: () => apiService.get('/tu-endpoint'),
  create: (data) => apiService.post('/tu-endpoint', data),
  // ... más métodos
}
```

### Personalizar Menú
Edita `src/components/Sidebar.jsx`:
```javascript
const menuItems = [
  {
    path: '/tu-seccion',
    icon: 'fas fa-tu-icono',
    label: 'Tu Sección',
    description: 'Descripción'
  }
];
```

## 🎯 Casos de Uso

### 🔥 Desarrollo Rápido
- Prueba endpoints mientras desarrollas
- Ve respuestas en tiempo real
- No necesitas Postman ni Swagger

### 🐛 Debug de APIs
- Historial de peticiones
- Tiempo de respuesta
- Manejo visual de errores

### 📊 Administración de Datos
- CRUD visual e intuitivo
- Múltiples formatos de vista
- Búsqueda y filtros

### 👨‍💼 Demos y Presentaciones
- Interfaz profesional
- Navegación intuitiva
- Datos en tiempo real

## 🚀 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run preview  # Preview del build
npm run lint     # Linter de código
```

## 🎨 Personalización

### Temas y Colores
Modifica `src/index.css` para cambiar:
- Colores primarios
- Fuentes
- Espaciado
- Animaciones

### Componentes
Todos los componentes son modulares y reutilizables:
- Fácil de extender
- Props configurables
- Estilos separados

## 🔧 Solución de Problemas

### ❌ Error de CORS
Configura tu backend para permitir:
```javascript
Access-Control-Allow-Origin: http://localhost:3000
```

### 🔌 Backend no responde
1. Verifica que esté en `localhost:8080`
2. Usa el botón "Probar Conexión"
3. Revisa la consola del navegador

### 📦 Problemas de dependencias
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📈 Roadmap

- [ ] Autenticación y autorización
- [ ] Filtros avanzados
- [ ] Exportación de datos
- [ ] Modo oscuro
- [ ] WebSocket support
- [ ] Gráficos y analytics

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Para contribuir:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📝 Licencia

MIT License - Úsa y modifica libremente.

## 🎉 ¡Disfruta!

Este frontend te permitirá ser **10x más productivo** que usando Swagger UI. 

**¿Dudas o sugerencias?** ¡Abre un issue!

---

**⭐ Si te gusta este proyecto, ¡dale una estrella!**
#   B u i l d   c o n   V I T E _ A P I _ U R L   c o n f i g u r a d a  
 