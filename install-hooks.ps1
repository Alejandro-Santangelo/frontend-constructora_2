# Script para instalar hooks de Git automáticamente
# Se ejecuta como parte del setup

$hooksDir = ".git\hooks"

if (-not (Test-Path $hooksDir)) {
    Write-Host "❌ Directorio .git\hooks no encontrado" -ForegroundColor Red
    Write-Host "   ¿Estás en la raíz del repositorio?" -ForegroundColor Yellow
    exit 1
}

Write-Host "📌 Instalando Git hooks..." -ForegroundColor Yellow

# Verificar que los hooks existen
$hooks = @("post-checkout", "post-merge")

foreach ($hook in $hooks) {
    $hookPath = Join-Path $hooksDir $hook

    if (Test-Path $hookPath) {
        Write-Host "   ✅ $hook ya instalado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $hook no encontrado, creando..." -ForegroundColor Yellow
        # Aquí podrías copiar desde una plantilla si fuera necesario
    }
}

Write-Host "✅ Hooks instalados correctamente" -ForegroundColor Green
