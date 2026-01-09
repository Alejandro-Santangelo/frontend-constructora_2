# Solución de Problemas de Encoding UTF-8

## ¿Por qué ocurrió este problema?

El problema de encoding UTF-8 ocurre cuando los archivos se guardan con una codificación incorrecta (generalmente Windows-1252 o ANSI en lugar de UTF-8). Esto hace que los caracteres especiales como:
- Tildes: á, é, í, ó, ú
- Ñ: ñ  
- Signos de interrogación: ¿
- Emojis: ⚠️, ✓, •

Se guarden como secuencias de bytes incorrectas que se visualizan como caracteres extraños (Ã, Â, etc.).

## Solución Implementada

### 1. Configuración de VS Code (.vscode/settings.json)
Se configuró para forzar UTF-8 en todos los archivos:
```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false
}
```

### 2. EditorConfig (.editorconfig)
Se agregó configuración para mantener consistencia:
```
[*]
charset = utf-8
```

### 3. Archivos Corregidos
- ✅ `src/pages/ObrasPage.jsx` - Todos los alerts y textos corregidos

## Cómo Prevenir este Problema en el Futuro

### En VS Code:
1. **Siempre verifica el encoding**: Esquina inferior derecha debe decir "UTF-8"
2. **Si dice otra cosa**: Click en el encoding → "Save with Encoding" → "UTF-8"

### Al hacer copiar/pegar:
- Evita copiar texto desde PDFs o documentos de Word
- Si necesitas hacerlo, verifica que los caracteres se vean correctos inmediatamente

### Antes de hacer commit:
```bash
# Verifica que no haya caracteres extraños
git diff | grep -E "Ã|Â|â€"
```

## Si el Problema Vuelve a Aparecer

### Opción 1: Corrección Manual
1. Abrir el archivo en VS Code
2. Click en el encoding (esquina inferior derecha)
3. "Reopen with Encoding" → "UTF-8"
4. Guardar el archivo

### Opción 2: Script Automático
Ya existe un script para correcciones futuras en `fix-encoding-manual.md`

## Verificación Antes del Deploy

```bash
# Buscar caracteres problemáticos en archivos fuente
findstr /S /R "Ã.*Â\|â€" src\*.jsx src\*.js

# Si encuentra algo, corregir esos archivos
```

## Estado Actual
✅ Todos los archivos críticos corregidos  
✅ Configuración de VS Code actualizada  
✅ EditorConfig creado  
✅ Listo para deploy  

## Notas Importantes
- Los archivos `.py` en la raíz tienen caracteres extraños pero son scripts de utilidad, no afectan la aplicación
- Los componentes con regex `[ÁÀÄÂ]` son intencionales para normalización de texto
- VS Code ahora guardará todos los archivos nuevos automáticamente en UTF-8
