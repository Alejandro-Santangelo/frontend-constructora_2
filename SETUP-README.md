# 🚀 Setup Automático del Proyecto

## Para Nuevos Desarrolladores

Cuando clones este repositorio o hagas pull por primera vez, ejecuta:

```bash
npm install
npm run setup
```

Esto configurará automáticamente:
- ✅ VS Code (encoding UTF-8 global)
- ✅ Git (normalización de líneas)
- ✅ Extensiones necesarias
- ✅ Verificación de archivos

## Scripts Disponibles

### `npm run setup`
Configura tu entorno de desarrollo automáticamente.
**Ejecutar una sola vez después de clonar el repositorio.**

### `npm run check-encoding`
Verifica si hay problemas de encoding en el código.
```bash
npm run check-encoding
```

### `npm run fix-encoding`
Corrige automáticamente problemas de encoding encontrados.
```bash
npm run fix-encoding
```

### `npm run dev`
Inicia el servidor de desarrollo.

### `npm run build`
Genera build de producción.

## ¿Por qué estos scripts?

Este proyecto usa **UTF-8** como encoding estándar para evitar caracteres corruptos (ñ, á, é, emojis, etc.). 

Los scripts garantizan que:
1. Todos trabajen con la misma configuración
2. No aparezcan caracteres extraños como `Ã±` en lugar de `ñ`
3. El código sea consistente en cualquier máquina

## Archivos de Configuración

- `.vscode/settings.json` - Configuración de VS Code del proyecto
- `.editorconfig` - Estándar universal de encoding
- `.gitattributes` - Normalización automática en Git

**⚠️ No elimines estos archivos, son esenciales para el equipo.**

## Solución de Problemas

### Veo caracteres extraños (ñ → Ã±)
```bash
npm run fix-encoding
```

### El setup no funciona
Asegúrate de tener instalado:
- Node.js 18+
- Git
- VS Code

### Problemas con PowerShell
Si el script de setup no ejecuta, habilita scripts:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Equipo de Desarrollo

Al agregar nuevos desarrolladores, pídeles que:
1. Clonen el repositorio
2. Ejecuten `npm install`
3. Ejecuten `npm run setup`
4. Reinicien VS Code

Eso es todo. ✅
