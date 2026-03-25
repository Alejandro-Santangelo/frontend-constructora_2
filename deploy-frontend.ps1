# Script de Deployment Rápido - Frontend Constructora
# Uso: .\deploy-frontend.ps1

Write-Host "🚀 ========================================" -ForegroundColor Cyan
Write-Host "🚀 DEPLOYMENT FRONTEND RAILWAY" -ForegroundColor Cyan
Write-Host "🚀 ========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que estamos en directorio correcto
if (!(Test-Path "package.json")) {
    Write-Host "❌ ERROR: Ejecutar desde directorio frontend-constructora_2" -ForegroundColor Red
    exit 1
}

# 2. Preguntar si ya probó localmente
Write-Host "⚠️  ¿Ya probaste localmente con 'npm run dev'? (S/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host
if ($response -ne "S" -and $response -ne "s") {
    Write-Host ""
    Write-Host "ℹ️  Recuerda probar localmente antes de desplegar:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host "   http://localhost:5173" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "¿Continuar de todos modos? (S/N): " -ForegroundColor Yellow -NoNewline
    $continue = Read-Host
    if ($continue -ne "S" -and $continue -ne "s") {
        Write-Host "❌ Deployment cancelado" -ForegroundColor Yellow
        exit 0
    }
}

# 3. Mostrar últimos commits
Write-Host ""
Write-Host "📝 Últimos commits:" -ForegroundColor Cyan
git log --oneline -3

# 4. Confirmar deployment
Write-Host ""
Write-Host "🚀 ¿Desplegar último commit a Railway? (S/N): " -ForegroundColor Green -NoNewline
$confirm = Read-Host
if ($confirm -ne "S" -and $confirm -ne "s") {
    Write-Host "❌ Deployment cancelado" -ForegroundColor Yellow
    exit 0
}

# 5. Link a Railway (si no está linkeado)
Write-Host ""
Write-Host "🔗 Verificando conexión Railway..." -ForegroundColor Cyan
$status = railway status 2>&1 | Out-String

if ($status -match "No linked project") {
    Write-Host "🔗 Linkeando proyecto Railway..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  IMPORTANTE: Seleccionar el SERVICIO FRONTEND correcto" -ForegroundColor Yellow
    Write-Host "   (NO seleccionar backend-constructora_2)" -ForegroundColor Yellow
    Write-Host ""
    railway link
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al linkear proyecto" -ForegroundColor Red
        exit 1
    }
}

# 6. Verificar que NO esté en servicio backend
$status = railway status | Out-String
if ($status -match "backend-constructora_2") {
    Write-Host ""
    Write-Host "❌ ========================================" -ForegroundColor Red
    Write-Host "❌ ERROR: Estás linkeado al BACKEND" -ForegroundColor Red
    Write-Host "❌ ========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Ejecuta: railway unlink" -ForegroundColor Yellow
    Write-Host "Luego: railway link" -ForegroundColor Yellow
    Write-Host "Y selecciona el servicio FRONTEND" -ForegroundColor Yellow
    exit 1
}

# 7. Railway UP!
Write-Host ""
Write-Host "🚀 ========================================" -ForegroundColor Green
Write-Host "🚀 INICIANDO DEPLOYMENT..." -ForegroundColor Green
Write-Host "🚀 Tiempo estimado: 2-3 minutos" -ForegroundColor Green
Write-Host "🚀 ========================================" -ForegroundColor Green
Write-Host ""

railway up

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ ========================================" -ForegroundColor Green
    Write-Host "✅ DEPLOYMENT EXITOSO!" -ForegroundColor Green
    Write-Host "✅ ========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 URL Frontend: https://zonal-curiosity-production-3041.up.railway.app" -ForegroundColor Cyan
    Write-Host "🧪 Probar login con PIN: 3333" -ForegroundColor Cyan
    Write-Host "📊 Ver logs: " -ForegroundColor Cyan -NoNewline
    Write-Host "railway logs" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "❌ ========================================" -ForegroundColor Red
    Write-Host "❌ DEPLOYMENT FALLÓ" -ForegroundColor Red
    Write-Host "❌ ========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Ver logs completos: railway logs" -ForegroundColor Yellow
    Write-Host "🔄 Rollback: git reset --hard <commit-anterior>" -ForegroundColor Yellow
    exit 1
}
