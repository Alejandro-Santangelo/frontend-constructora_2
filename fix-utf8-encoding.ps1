# Script para corregir encoding UTF-8 en archivos del proyecto
# Este script re-guarda todos los archivos .js y .jsx con UTF-8 sin BOM

Write-Host "🔧 Iniciando corrección de encoding UTF-8..." -ForegroundColor Cyan
Write-Host ""

# Obtener todos los archivos .js y .jsx
$archivos = Get-ChildItem -Path "src" -Include "*.js","*.jsx" -Recurse -File

$contador = 0
$total = $archivos.Count

Write-Host "📁 Encontrados $total archivos a procesar" -ForegroundColor Yellow
Write-Host ""

foreach ($archivo in $archivos) {
    $contador++
    $rutaRelativa = $archivo.FullName.Replace($PWD.Path + "\", "")

    Write-Host "[$contador/$total] Procesando: $rutaRelativa" -ForegroundColor Gray

    try {
        # Leer el contenido con UTF-8
        $contenido = Get-Content -Path $archivo.FullName -Encoding UTF8 -Raw

        # Re-guardar con UTF-8 sin BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($archivo.FullName, $contenido, $utf8NoBom)

        Write-Host "  ✅ Corregido" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Proceso completado. $total archivos procesados." -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Si ves caracteres raros en el código fuente:" -ForegroundColor Yellow
Write-Host "   1. Cierra VS Code completamente" -ForegroundColor Yellow
Write-Host "   2. Vuelve a abrir el proyecto" -ForegroundColor Yellow
Write-Host "   3. Verifica que VS Code esté usando 'UTF-8' en la barra de estado" -ForegroundColor Yellow
Write-Host ""
