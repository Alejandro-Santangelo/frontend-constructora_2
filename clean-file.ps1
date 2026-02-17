$filePath = "src\hooks\useEstadisticasObrasSeleccionadas.js"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Eliminar caracteres corruptos y dejar solo ASCII + caracteres latinos básicos
$content = $content -creplace '[^\x20-\x7E\r\n\t\u00A0-\u00FF\u0100-\u017F]', ''

# Normalizar saltos de línea
$content = $content -replace "`r`n", "`n"

# Guardar
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Archivo limpiado" -ForegroundColor Green
