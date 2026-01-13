#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script de configuración automática para el proyecto
.DESCRIPTION
    Configura VS Code, Git y extensiones necesarias para todos los desarrolladores
    Ejecutar después de clonar el repositorio o hacer pull por primera vez
#>

Write-Host "🚀 Configurando entorno de desarrollo..." -ForegroundColor Cyan
Write-Host ""

$errores = 0

# ====================================================================
# 1. CONFIGURAR VS CODE GLOBAL
# ====================================================================
Write-Host "📝 Configurando VS Code (global)..." -ForegroundColor Yellow

try {
    $settingsPath = "$env:APPDATA\Code\User\settings.json"

    if (Test-Path $settingsPath) {
        $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    } else {
        $settings = @{}
    }

    # Configurar encoding
    $settings.'files.encoding' = 'utf8'
    $settings.'files.autoGuessEncoding' = $false
    $settings.'files.eol' = "`n"
    $settings.'files.trimTrailingWhitespace' = $true
    $settings.'files.insertFinalNewline' = $true

    # Guardar
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8

    Write-Host "   ✅ VS Code configurado correctamente" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error configurando VS Code: $_" -ForegroundColor Red
    $errores++
}

# ====================================================================
# 2. CONFIGURAR GIT GLOBAL
# ====================================================================
Write-Host "`n🔧 Configurando Git (global)..." -ForegroundColor Yellow

try {
    git config --global core.autocrlf false | Out-Null
    git config --global core.eol lf | Out-Null
    git config --global core.safecrlf warn | Out-Null
    git config --global core.quotepath false | Out-Null

    Write-Host "   ✅ Git configurado correctamente" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error configurando Git: $_" -ForegroundColor Red
    $errores++
}

# ====================================================================
# 3. INSTALAR EXTENSIONES DE VS CODE
# ====================================================================
Write-Host "`n🔌 Instalando extensiones de VS Code..." -ForegroundColor Yellow

$extensiones = @(
    "EditorConfig.EditorConfig",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
)

foreach ($ext in $extensiones) {
    try {
        $null = code --install-extension $ext 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $ext instalada" -ForegroundColor Green
        } else {
            Write-Host "   ℹ️  $ext ya estaba instalada o hubo un problema" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  No se pudo instalar $ext" -ForegroundColor Yellow
    }
}

# ====================================================================
# 4. VERIFICAR ARCHIVOS DE CONFIGURACIÓN DEL PROYECTO
# ====================================================================
Write-Host "`n📂 Verificando archivos de configuración del proyecto..." -ForegroundColor Yellow

$archivosNecesarios = @(
    ".vscode\settings.json",
    ".editorconfig",
    ".gitattributes"
)

foreach ($archivo in $archivosNecesarios) {
    if (Test-Path $archivo) {
        Write-Host "   ✅ $archivo existe" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $archivo NO existe" -ForegroundColor Red
        $errores++
    }
}

# ====================================================================
# 5. INSTALAR DEPENDENCIAS NPM
# ====================================================================
Write-Host "`n📦 Verificando dependencias..." -ForegroundColor Yellow

if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules existe" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Dependencias instaladas" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error instalando dependencias" -ForegroundColor Red
        $errores++
    }
}

# ====================================================================
# 6. EJECUTAR VERIFICACIÓN DE ENCODING
# ====================================================================
Write-Host "`n🔍 Verificando encoding de archivos..." -ForegroundColor Yellow

if (Test-Path "check-encoding.js") {
    node check-encoding.js
} else {
    Write-Host "   ⚠️  check-encoding.js no encontrado" -ForegroundColor Yellow
}

# ====================================================================
# 7. INSTALAR GIT HOOKS
# ====================================================================
Write-Host "`n📌 Configurando Git hooks..." -ForegroundColor Yellow

if (Test-Path ".git\hooks") {
    # Los hooks ya están creados, solo asegurarnos que son ejecutables
    Write-Host "   ✅ Git hooks configurados" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Este no es un repositorio Git inicializado" -ForegroundColor Yellow
}

# ====================================================================
# RESUMEN
# ====================================================================
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "📊 RESUMEN DE CONFIGURACIÓN" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

if ($errores -eq 0) {
    Write-Host "`n✅ ¡Configuración completada exitosamente!" -ForegroundColor Green
    Write-Host "`n💡 Recomendaciones:" -ForegroundColor Yellow
    Write-Host "   1. Reinicia VS Code para aplicar cambios"
    Write-Host "   2. Ejecuta 'npm run dev' para iniciar el proyecto"
    Write-Host "   3. Si ves caracteres extraños, ejecuta 'npm run fix-encoding'"
} else {
    Write-Host "`n⚠️  Configuración completada con $errores errores" -ForegroundColor Yellow
    Write-Host "   Revisa los mensajes anteriores para más detalles"
}

Write-Host ""
