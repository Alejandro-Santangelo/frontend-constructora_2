# Script para limpiar caracteres corruptos en useEstadisticasObrasSeleccionadas.js
$filePath = "src\hooks\useEstadisticasObrasSeleccionadas.js"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Reemplazar caracteres corruptos comunes
$replacements = @{
    'Ã°Å¸â€ â€¢' = '🆕'
    'Ã°Å¸â€Â' = '🔍'
    'Ã°Å¸â€œâ€¹' = '📋'
    'Ã¢Å¡Â Ã¯Â¸Â' = '⚠️'
    'Ã°Å¸â€™Â°' = '💰'
    'Ã°Å¸â€Â§' = '🔧'
    'Ã°Å¸â€â€' = '🔥'
    'Ã°Å¸â€â€ž' = '🔄'
    'Ã°Å¸â€â€' = '🔔'
    'Ã¢Å½â€º' = '❌'
    'estadÃƒÂ­sticas' = 'estadísticas'
    'especÃƒÂ­ficamente' = 'específicamente'
    'FunciÃƒÂ³n' = 'Función'
    'automÃƒÂ¡ticamente' = 'automáticamente'
}

foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
}

# Guardar con UTF-8 sin BOM
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "✅ Archivo limpiado correctamente" -ForegroundColor Green
