$filePath = "src\hooks\useEstadisticasObrasSeleccionadas.js"
$content = Get-Content $filePath -Raw

# Reemplazos específicos de caracteres corruptos
$content = $content -replace 'Ã°Å¸â â¢', ''
$content = $content -replace 'Ã°Å¸âÂ', ''
$content = $content -replace 'Ã°Å¸âœâ¹', ''
$content = $content -replace 'Ã¢Å¡Â Ã¯Â¸Â', ''
$content = $content -replace 'Ã°Å¸ââ°', ''
$content = $content -replace 'Ã°Å¸âÂ§', ''
$content = $content -replace 'Ã°Å¸ââ', ''
$content = $content -replace 'Ã°Å¸ââž', ''
$content = $content -replace 'Ã°Å¸ââ', ''
$content = $content -replace 'Ã¢Å½â', ''
$content = $content -replace 'estadÃÂ­sticas', 'estadisticas'
$content = $content -replace 'especÃÂ­ficamente', 'especificamente'
$content = $content -replace 'FunciÃÂ³n', 'Funcion'
$content = $content -replace 'automÃÂ¡ticamente', 'automaticamente'

# Limpiar cualquier carácter de control o Unicode problemático
$content = $content -replace '[\u0080-\u009F]', ''
$content = $content -replace 'Ã[^a-zA-Z\s]', ''
$content = $content -replace 'Â[^a-zA-Z\s]', ''
$content = $content -replace 'â[^a-zA-Z\s]', ''
$content = $content -replace 'Å[^a-zA-Z\s]', ''

# Normalizar
$content = $content -replace "`r`n", "`n"

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Limpieza completa" -ForegroundColor Green
