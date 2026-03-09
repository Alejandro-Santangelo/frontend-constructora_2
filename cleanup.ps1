# Cleanup Frontend - Mover archivos obsoletos a _to_delete/
# Estrategia segura: Mover a carpeta temporal, probar, eliminar despues

Write-Host "Cleanup Frontend Repository (Safe Mode)" -ForegroundColor Cyan
Write-Host ""

# Crear carpeta temporal
$deleteDir = "_to_delete"

if (-not (Test-Path $deleteDir)) {
    New-Item -ItemType Directory -Path $deleteDir | Out-Null
    Write-Host "Carpeta creada: $deleteDir" -ForegroundColor Green
} else {
    Write-Host "Usando carpeta existente: $deleteDir" -ForegroundColor Yellow
}

Write-Host ""

# Archivos y carpetas a CONSERVAR (whitelist estricta)
$keep = @(
    # Carpetas esenciales del proyecto
    "src", "dist", "node_modules", ".vscode", ".git",
    "_to_delete",
    
    # Archivos esenciales del proyecto React/Vite
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "index.html",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".env.development",
    ".env.production",
    
    # Documentacion esencial
    "README.md",
    
    # Script de limpieza
    "cleanup.ps1"
)

Write-Host "Moviendo archivos a $deleteDir..." -ForegroundColor Yellow
Write-Host ""

$movedCount = 0
$keptCount = 0

# Obtener todos los archivos y carpetas en raiz
Get-ChildItem -Path . -Force | ForEach-Object {
    $itemName = $_.Name
    
    # Saltar si esta en la whitelist
    if ($keep -contains $itemName) {
        Write-Host "  [OK] Conservando: $itemName" -ForegroundColor Green
        $keptCount++
        return
    }
    
    # Mover a _to_delete
    try {
        $destPath = Join-Path $deleteDir $itemName
        if (Test-Path $destPath) {
            Write-Host "  [SKIP] Ya existe en _to_delete: $itemName" -ForegroundColor Yellow
        } else {
            Move-Item -Path $_.FullName -Destination $deleteDir -Force
            Write-Host "  [MOVED] $itemName" -ForegroundColor Gray
            $movedCount++
        }
    } catch {
        Write-Host "  [ERROR] moviendo $itemName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Limpieza completada!" -ForegroundColor Green
Write-Host ""
Write-Host "RESUMEN:" -ForegroundColor Cyan
Write-Host "  Movidos a _to_delete/: $movedCount archivos/carpetas" -ForegroundColor Gray
Write-Host "  Conservados: $keptCount archivos/carpetas" -ForegroundColor Gray
Write-Host ""
Write-Host "PROXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "  1. Probar la aplicacion por 3-7 dias" -ForegroundColor White
Write-Host "  2. Ejecutar npm run dev y verificar que funciona" -ForegroundColor White
Write-Host "  3. Deployar a Railway y verificar" -ForegroundColor White
Write-Host "  4. Si todo OK, eliminar definitivamente:" -ForegroundColor White
Write-Host "     Remove-Item -Recurse -Force _to_delete" -ForegroundColor Cyan
Write-Host ""
Write-Host "RESTAURAR archivo si lo necesitas:" -ForegroundColor Yellow
Write-Host "  Move-Item _to_delete\<archivo> ." -ForegroundColor Gray
Write-Host ""
Write-Host "REVISAR que se movio:" -ForegroundColor Yellow
Write-Host "  Get-ChildItem _to_delete" -ForegroundColor Gray
Write-Host ""

# Mostrar estructura LIMPIA del repositorio
Write-Host "Archivos conservados en raiz:" -ForegroundColor Cyan
Get-ChildItem -Path . -Force -Name | Where-Object { $_ -ne "_to_delete" } | ForEach-Object {
    Write-Host "  $_" -ForegroundColor White
}

Write-Host ""
Write-Host "Repositorio organizado - _to_delete/ listo para revision" -ForegroundColor Green
